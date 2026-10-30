import type {
  ActivityNode,
  ActivitySlot,
  ArgumentDirection,
  FlowNode,
  FlowchartActivity,
  GenericActivity,
  Point,
  StateMachineActivity,
  StateNode,
  StateTransition,
  ViewState,
  WorkflowArgument,
  WorkflowDocument,
  WorkflowVariable,
} from './model.js';
import { formatExpression } from './project.js';
import { deepText, localOf, parseXml, prefixOf, type XElement } from './xml.js';

const XAML_NS = 'http://schemas.microsoft.com/winfx/2006/xaml';
const WPF_NS = 'http://schemas.microsoft.com/winfx/2006/xaml/presentation';

/** Elements that hold values, not activities. */
const VALUE_LOCALS = new Set([
  'InArgument', 'OutArgument', 'InOutArgument', 'Literal', 'VisualBasicValue', 'VisualBasicReference',
  'CSharpValue', 'CSharpReference', 'Variable', 'DelegateInArgument', 'DelegateOutArgument', 'Reference', 'Null',
  'String', 'Boolean', 'Int32', 'Int64', 'Double', 'Decimal', 'Object', 'TimeSpan', 'Array', 'List', 'Dictionary',
  'Collection', 'Point', 'Size', 'PointCollection', 'Type', 'Static',
]);

/** Activities recognised even when Studio wrote them without DisplayName or IdRef. */
const KNOWN_ACTIVITY_LOCALS = new Set([
  'Sequence', 'Flowchart', 'StateMachine', 'If', 'While', 'DoWhile', 'ForEach', 'ParallelForEach', 'Switch',
  'TryCatch', 'Parallel', 'Pick', 'PickBranch', 'Assign', 'Delay', 'Throw', 'Rethrow', 'WriteLine', 'InvokeMethod',
]);

const NULL_VALUE = '{x:Null}';

/** Parser state for one document. */
class Context {
  private counter = 0;
  readonly warnings: string[] = [];
  usesCSharp = false;
  usesVisualBasic = false;

  constructor(private readonly ns: Record<string, string>) {}

  uri(name: string): string {
    return this.ns[prefixOf(name)] ?? '';
  }

  nextId(local: string): string {
    this.counter += 1;
    return `${local}_auto${this.counter}`;
  }
}

/** Decodes numeric character references that the XML parser leaves in attribute values, such as `&#xA;`. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

const isPropertyOf = (child: XElement, parent: XElement) => child.name.startsWith(parent.name + '.');
const isAttached = (child: XElement, parent: XElement) => localOf(child.name).includes('.') && !isPropertyOf(child, parent);
const suffixOf = (child: XElement, parent: XElement) => child.name.slice(parent.name.length + 1);
const attrBySuffix = (el: XElement, suffix: string) => Object.entries(el.attrs).find(([k]) => k.endsWith(suffix))?.[1];
const childBySuffix = (el: XElement, suffix: string) => el.children.find((c) => c.name.endsWith(suffix));
/** Strips namespace prefixes from a XAML type, e.g. `scg:List(x:String)` becomes `List(String)`. */
const typeName = (t: string | undefined) => (t ? t.replace(/\b[A-Za-z]\w*:(?=[A-Za-z_])/g, '') : '');
const refTarget = (value: string | undefined) => value?.match(/^\{x:Reference\s+([^}]+)\}$/)?.[1]?.trim();

function isValueElement(el: XElement, ctx: Context): boolean {
  const uri = ctx.uri(el.name);
  return VALUE_LOCALS.has(localOf(el.name)) || uri === XAML_NS || uri === WPF_NS || uri.startsWith('clr-namespace:System');
}

function hasIdRef(el: XElement): boolean {
  return attrBySuffix(el, 'WorkflowViewState.IdRef') !== undefined || childBySuffix(el, 'WorkflowViewState.IdRef') !== undefined;
}

function isActivityLike(el: XElement, ctx: Context): boolean {
  if (localOf(el.name).includes('.') || isValueElement(el, ctx)) return false;
  return KNOWN_ACTIVITY_LOCALS.has(localOf(el.name)) || 'DisplayName' in el.attrs || hasIdRef(el);
}

function annotationOf(el: XElement): string | undefined {
  const value = attrBySuffix(el, 'Annotation.AnnotationText') ?? childBySuffix(el, 'Annotation.AnnotationText')?.text;
  return value ? decodeEntities(value) : undefined;
}

function parsePoints(text: string): Point[] {
  return text
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter((p) => p.length === 2 && p.every(Number.isFinite))
    .map(([x, y]) => ({ x, y }));
}

function parseViewState(el: XElement): ViewState | undefined {
  const holder = childBySuffix(el, 'WorkflowViewStateService.ViewState');
  const dict = holder?.children[0];
  if (!dict) return undefined;
  const vs: ViewState = {};
  for (const entry of dict.children) {
    const key = entry.attrs['x:Key'];
    const local = localOf(entry.name);
    if (local === 'Point' && key === 'ShapeLocation') vs.location = parsePoints(entry.text)[0];
    else if (local === 'Size' && key === 'ShapeSize') {
      const [w, h] = entry.text.split(',').map(Number);
      if (Number.isFinite(w) && Number.isFinite(h)) vs.size = { width: w, height: h };
    } else if (local === 'Boolean' && key === 'IsExpanded') vs.isExpanded = entry.text.trim() === 'True';
    else if (local === 'PointCollection' && key) (vs.connectors ??= {})[key] = parsePoints(entry.text);
  }
  return vs;
}

function noteExpressions(el: XElement, ctx: Context): void {
  const local = localOf(el.name);
  if (local === 'CSharpValue' || local === 'CSharpReference') ctx.usesCSharp = true;
  if (local === 'VisualBasicValue' || local === 'VisualBasicReference') ctx.usesVisualBasic = true;
  el.children.forEach((c) => noteExpressions(c, ctx));
}

/** Elements whose content is one expression or literal. */
const EXPRESSION_LOCALS = new Set([
  'InArgument', 'OutArgument', 'InOutArgument', 'Literal', 'VisualBasicValue', 'VisualBasicReference', 'CSharpValue', 'CSharpReference',
]);

/** Filter Data Table operators as Studio shows them. */
const FILTER_OPERATORS: Record<string, string> = {
  EQ: '=', NE: '≠', GT: '>', GE: '≥', LT: '<', LE: '≤',
  CONTAINS: 'contains', STARTS_WITH: 'starts with', ENDS_WITH: 'ends with', EMPTY: 'empty', NOT_EMPTY: 'not empty',
};

const plainAttrs = (el: XElement) =>
  Object.entries(el.attrs).filter(
    ([k, v]) => v !== NULL_VALUE && !k.startsWith('x:') && !k.startsWith('xmlns') && !localOf(k).includes('.') && k !== 'Capacity',
  );

/** One filter row, e.g. `Or "Age" > 18`. The And/Or is left out on the first row, like in Studio. */
function filterText(el: XElement, ctx: Context, index: number): string {
  const part = (suffix: string) => {
    const prop = el.children.find((c) => c.name === `${el.name}.${suffix}`);
    return prop ? formatExpression(prop.children.map((c) => objectText(c, ctx)).join(' ') || decodeEntities(prop.text)) : '';
  };
  const op = el.attrs.Operator ?? '';
  const words = [index > 0 ? el.attrs.BooleanOperator : undefined, part('Column'), FILTER_OPERATORS[op] ?? op, part('Operand')];
  return words.filter(Boolean).join(' ');
}

/**
 * Readable text for a value element. Expressions keep their text as written; lists become one line per item;
 * other objects become `Type { Name=value, ... }`.
 */
function objectText(el: XElement, ctx: Context, index = 0): string {
  const local = localOf(el.name);
  if (local === 'Null') return '';
  if (EXPRESSION_LOCALS.has(local)) return decodeEntities(deepText(el));
  if (local === 'FilterOperationArgument') return filterText(el, ctx, index);
  if (local === 'AssignOperation') {
    const side = (suffix: string) => {
      const prop = el.children.find((c) => c.name === `${el.name}.${suffix}`);
      return prop ? formatExpression(prop.children.map((c) => objectText(c, ctx)).join(' ') || decodeEntities(prop.text)) : '';
    };
    return `${side('To')} = ${side('Value')}`;
  }
  const props = el.children.filter((c) => isPropertyOf(c, el));
  const items = el.children.filter((c) => !isPropertyOf(c, el) && !isAttached(c, el));
  const attrs = plainAttrs(el);
  if (!props.length && !items.length) {
    if (el.text) return decodeEntities(el.text);
    return attrs.length ? `${local} { ${attrs.map(([k, v]) => `${k}=${decodeEntities(v)}`).join(', ')} }` : '';
  }
  if (!props.length && !attrs.length) return items.map((c, i) => objectText(c, ctx, i)).filter(Boolean).join('\n');
  const parts = [
    ...attrs.map(([k, v]) => `${k}=${decodeEntities(v)}`),
    ...props.map((p) => `${suffixOf(p, el)}=${formatExpression(p.children.map((c) => objectText(c, ctx)).join(', ') || decodeEntities(p.text))}`),
    ...items.map((c, i) => formatExpression(objectText(c, ctx, i))),
  ];
  return `${local} { ${parts.join(', ')} }`;
}

/** Text of a value element: an expression, a literal, a list or an object summary. */
function valueText(el: XElement, ctx: Context): string {
  noteExpressions(el, ctx);
  return objectText(el, ctx);
}

const URI_NAMESPACES: Record<string, string> = {
  'http://schemas.microsoft.com/netfx/2009/xaml/activities': 'System.Activities.Statements',
  'http://schemas.uipath.com/workflow/activities/uix': 'UiPath.UIAutomationNext.Activities',
};
const UIPATH_URI = 'http://schemas.uipath.com/workflow/activities';

/** Several UiPath packages share one schema URI; pick the package from the activity name. */
function uipathNamespace(local: string): string {
  if (/^Excel/.test(local)) return 'UiPath.Excel.Activities';
  if (/Outlook/i.test(local)) return 'UiPath.Mail.Outlook.Activities';
  if (/Smtp/i.test(local)) return 'UiPath.Mail.SMTP.Activities';
  if (/Imap/i.test(local)) return 'UiPath.Mail.IMAP.Activities';
  if (/Pop3/i.test(local)) return 'UiPath.Mail.POP3.Activities';
  if (/Exchange/i.test(local)) return 'UiPath.Mail.Exchange.Activities';
  return 'UiPath.Core.Activities';
}

/** Full .NET type of an activity element, e.g. `UiPath.Core.Activities.ForEach<Decimal>`. */
function fullTypeOf(el: XElement, ctx: Context): { fullType?: string; fullTypeInferred?: boolean } {
  const uri = ctx.uri(el.name);
  const local = localOf(el.name);
  const clr = uri.match(/^clr-namespace:([^;]+)/)?.[1];
  const ns = clr ?? URI_NAMESPACES[uri] ?? (uri === UIPATH_URI ? uipathNamespace(local) : undefined);
  if (!ns) return {};
  const args = el.attrs['x:TypeArguments'];
  return { fullType: `${ns}.${local}${args ? `<${typeName(args)}>` : ''}`, fullTypeInferred: !clr };
}

function parseVariables(prop: XElement, scope: string, ctx: Context): WorkflowVariable[] {
  return prop.children
    .filter((v) => localOf(v.name) === 'Variable')
    .map((v) => {
      const defaultChild = v.children.find((c) => c.name.endsWith('.Default'));
      const defaultValue = v.attrs.Default ?? (defaultChild ? valueText(defaultChild, ctx) : undefined);
      return {
        name: v.attrs.Name ?? '(unnamed)',
        type: typeName(v.attrs['x:TypeArguments']),
        defaultValue: defaultValue ? decodeEntities(defaultValue) : undefined,
        scope,
      };
    });
}

/** Reads an ActivityAction / ActivityFunc: its argument names and body activities. */
function parseDelegate(el: XElement, ctx: Context): { argument?: string; children: ActivityNode[] } {
  const args: string[] = [];
  const children: ActivityNode[] = [];
  for (const c of el.children) {
    if (isPropertyOf(c, el)) {
      for (const a of c.children) if (a.attrs.Name) args.push(a.attrs.Name);
    } else if (!isAttached(c, el) && !isValueElement(c, ctx)) {
      children.push(parseActivity(c, ctx));
    }
  }
  return { argument: args.length ? args.join(', ') : undefined, children };
}

function isDelegate(el: XElement): boolean {
  const local = localOf(el.name);
  return local === 'ActivityAction' || local === 'ActivityFunc';
}

function baseOf(el: XElement, ctx: Context) {
  const local = localOf(el.name);
  const idRef = attrBySuffix(el, 'WorkflowViewState.IdRef') ?? childBySuffix(el, 'WorkflowViewState.IdRef')?.text;
  const viewState = parseViewState(el);
  return {
    id: idRef || ctx.nextId(local),
    type: el.name,
    localType: local,
    displayName: decodeEntities(el.attrs.DisplayName ?? local),
    annotation: annotationOf(el),
    properties: {} as Record<string, string>,
    variables: [] as WorkflowVariable[],
    viewState,
    isExpanded: viewState?.isExpanded,
    ...fullTypeOf(el, ctx),
  };
}

/** Copies plain attributes of an activity into its property map. */
function readAttributes(el: XElement, properties: Record<string, string>, skip: string[] = []): void {
  for (const [k, v] of Object.entries(el.attrs)) {
    if (k === 'DisplayName' || k.startsWith('xmlns') || k.startsWith('mc:') || k === 'x:Name' || k === 'x:Key') continue;
    if (localOf(k).includes('.') || v === NULL_VALUE || skip.includes(k)) continue;
    properties[k === 'x:TypeArguments' ? 'TypeArguments' : k] = decodeEntities(v);
  }
}

function parseActivity(el: XElement, ctx: Context): ActivityNode {
  const local = localOf(el.name);
  if (local === 'Flowchart') return parseFlowchart(el, ctx);
  if (local === 'StateMachine') return parseStateMachine(el, ctx);

  const node: GenericActivity = { ...baseOf(el, ctx), kind: 'activity', slots: [] };
  readAttributes(el, node.properties);
  const slot = (name: string, argument?: string): ActivitySlot => {
    let s = node.slots.find((x) => x.name === name);
    if (!s) node.slots.push((s = { name, argument, children: [] }));
    return s;
  };

  for (const child of el.children) {
    if (isPropertyOf(child, el)) {
      const suffix = suffixOf(child, el);
      if (suffix === 'Variables') {
        node.variables.push(...parseVariables(child, node.displayName, ctx));
      } else if (suffix === 'Catches') {
        for (const c of child.children) {
          const action = c.children.find(isDelegate);
          const parsed = action ? parseDelegate(action, ctx) : { argument: undefined, children: [] };
          slot(`Catch (${typeName(c.attrs['x:TypeArguments']) || 'Exception'})`, parsed.argument).children.push(...parsed.children);
        }
      } else if (child.children.some(isDelegate)) {
        for (const d of child.children.filter(isDelegate)) {
          const parsed = parseDelegate(d, ctx);
          slot(suffix, parsed.argument).children.push(...parsed.children);
        }
      } else if (child.children.some((c) => isActivityLike(c, ctx))) {
        const s = slot(suffix);
        for (const c of child.children) if (!isValueElement(c, ctx)) s.children.push(parseActivity(c, ctx));
      } else if (child.children.length === 0) {
        if (child.text) node.properties[suffix] = decodeEntities(child.text);
      } else {
        for (const c of child.children) {
          const key = c.attrs['x:Key'];
          const value = valueText(c, ctx);
          if (!value) continue;
          const name = key ? `${suffix}.${key}` : suffix;
          node.properties[name] = node.properties[name] ? `${node.properties[name]}; ${value}` : value;
        }
      }
    } else if (isAttached(child, el)) {
      continue;
    } else if (isActivityLike(child, ctx) || (!isValueElement(child, ctx) && child.children.length > 0)) {
      const key = child.attrs['x:Key'];
      slot(key !== undefined ? `Case ${key}` : '').children.push(parseActivity(child, ctx));
    } else if (child.attrs['x:Key'] !== undefined) {
      node.properties[child.attrs['x:Key']] = valueText(child, ctx);
    }
  }
  // Studio keeps an unnamed slot first so a Sequence reads top to bottom.
  node.slots.sort((a, b) => (a.name === '' ? -1 : b.name === '' ? 1 : 0));
  if (local === 'MultipleAssign') node.assignments = assignmentsOf(el, ctx);
  return node;
}

/** Reads the rows of a Multiple Assign: each `AssignOperation` with its `To` and `Value`. */
function assignmentsOf(el: XElement, ctx: Context): { to: string; value: string }[] {
  const rows: { to: string; value: string }[] = [];
  const visit = (e: XElement) => {
    if (localOf(e.name) === 'AssignOperation') {
      const side = (suffix: string) => {
        const prop = e.children.find((c) => c.name === `${e.name}.${suffix}`);
        return prop ? prop.children.map((c) => valueText(c, ctx)).join(' ') || decodeEntities(prop.text) : '';
      };
      rows.push({ to: side('To'), value: side('Value') });
    } else e.children.forEach(visit);
  };
  el.children.filter((c) => c.name === `${el.name}.AssignOperations`).forEach(visit);
  return rows;
}

function firstActivity(el: XElement | undefined, ctx: Context): ActivityNode | undefined {
  if (!el) return undefined;
  const c = el.children.find((x) => !isValueElement(x, ctx) && !localOf(x.name).includes('.'));
  return c ? parseActivity(c, ctx) : undefined;
}

const FLOW_LOCALS = new Set(['FlowStep', 'FlowDecision', 'FlowSwitch']);

function parseFlowchart(el: XElement, ctx: Context): FlowchartActivity {
  const fc: FlowchartActivity = { ...baseOf(el, ctx), kind: 'flowchart', nodes: [], edges: [] };
  readAttributes(el, fc.properties, ['ValidateUnconnectedNodes']);
  const byId = new Map<string, FlowNode>();

  // Returns the id of the node an element points at: an inline node or an x:Reference.
  const visit = (n: XElement): string | undefined => {
    const local = localOf(n.name);
    if (local === 'Reference' && ctx.uri(n.name) === XAML_NS) return n.text.trim() || undefined;
    if (!FLOW_LOCALS.has(local)) return undefined;
    const id = n.attrs['x:Name'] ?? ctx.nextId(local);
    if (byId.has(id)) return id;
    const node: FlowNode = {
      id,
      kind: local === 'FlowStep' ? 'step' : local === 'FlowDecision' ? 'decision' : 'switch',
      displayName: decodeEntities(n.attrs.DisplayName ?? (local === 'FlowDecision' ? 'Flow Decision' : local === 'FlowSwitch' ? 'Flow Switch' : '')),
      annotation: annotationOf(n),
      viewState: parseViewState(n),
    };
    byId.set(id, node);
    fc.nodes.push(node);
    const edge = (target: string | undefined, label?: string, connectorKey?: string) => {
      if (target) fc.edges.push({ from: id, to: target, label, connectorKey });
    };
    // Attribute form: True="{x:Reference __ReferenceID2}".
    for (const [attr, key] of [['Next', 'ConnectorLocation'], ['True', 'TrueConnector'], ['False', 'FalseConnector'], ['Default', 'DefaultConnector']] as const) {
      const target = refTarget(n.attrs[attr]);
      if (target) edge(target, attr === 'Next' ? undefined : attr, key);
    }
    if (n.attrs.Condition) node.expression = decodeEntities(n.attrs.Condition);
    if (n.attrs.Expression) node.expression = decodeEntities(n.attrs.Expression);

    for (const c of n.children) {
      if (isPropertyOf(c, n)) {
        const suffix = suffixOf(c, n);
        if (suffix === 'Condition' || suffix === 'Expression') {
          node.expression = c.children.map((x) => valueText(x, ctx)).join(' ') || c.text;
          continue;
        }
        const label = suffix === 'Next' ? undefined : suffix;
        const key = suffix === 'Next' ? 'ConnectorLocation' : `${suffix}Connector`;
        for (const target of c.children) edge(visit(target), label, key);
      } else if (isAttached(c, n)) {
        continue;
      } else if (local === 'FlowSwitch' && c.attrs['x:Key'] !== undefined) {
        edge(visit(c), c.attrs['x:Key']);
      } else if (local === 'FlowStep' && !node.activity && !isValueElement(c, ctx)) {
        node.activity = parseActivity(c, ctx);
        if (!node.displayName) node.displayName = node.activity.displayName;
      }
    }
    if (!node.displayName) node.displayName = 'Empty step';
    return id;
  };

  for (const c of el.children) {
    if (isPropertyOf(c, el)) {
      const suffix = suffixOf(c, el);
      if (suffix === 'StartNode') fc.startNode = c.children.map(visit).find(Boolean);
      else if (suffix === 'Variables') fc.variables.push(...parseVariables(c, fc.displayName, ctx));
    } else if (!isAttached(c, el)) {
      visit(c);
    }
  }
  // Drop edges to references that never resolved, so renderers can trust the graph.
  const dangling = fc.edges.filter((e) => !byId.has(e.to));
  if (dangling.length) {
    ctx.warnings.push(`Flowchart "${fc.displayName}" has ${dangling.length} connector(s) to missing steps — the XAML references names that are not defined. Open and save the workflow in Studio to repair it.`);
    fc.edges = fc.edges.filter((e) => byId.has(e.to));
  }
  if (fc.startNode && !byId.has(fc.startNode)) fc.startNode = undefined;
  return fc;
}

function parseStateMachine(el: XElement, ctx: Context): StateMachineActivity {
  const sm: StateMachineActivity = { ...baseOf(el, ctx), kind: 'stateMachine', states: [], transitions: [] };
  readAttributes(el, sm.properties);
  const byId = new Map<string, StateNode>();

  const visit = (s: XElement): string | undefined => {
    const local = localOf(s.name);
    if (local === 'Reference' && ctx.uri(s.name) === XAML_NS) return s.text.trim() || undefined;
    if (local !== 'State') return undefined;
    const id = s.attrs['x:Name'] ?? ctx.nextId('State');
    if (byId.has(id)) return id;
    const state: StateNode = {
      id,
      displayName: decodeEntities(s.attrs.DisplayName ?? 'State'),
      isFinal: s.attrs.IsFinal === 'True',
      annotation: annotationOf(s),
      viewState: parseViewState(s),
    };
    byId.set(id, state);
    sm.states.push(state);
    for (const c of s.children) {
      if (!isPropertyOf(c, s)) continue;
      const suffix = suffixOf(c, s);
      if (suffix === 'Entry') state.entry = firstActivity(c, ctx);
      else if (suffix === 'Exit') state.exit = firstActivity(c, ctx);
      else if (suffix === 'Variables') sm.variables.push(...parseVariables(c, state.displayName, ctx));
      else if (suffix === 'Transitions') {
        for (const t of c.children.filter((x) => localOf(x.name) === 'Transition')) {
          const tr: StateTransition = {
            id: attrBySuffix(t, 'WorkflowViewState.IdRef') ?? ctx.nextId('Transition'),
            from: id,
            to: refTarget(t.attrs.To) ?? '',
            displayName: decodeEntities(t.attrs.DisplayName ?? 'Transition'),
            condition: t.attrs.Condition ? decodeEntities(t.attrs.Condition) : undefined,
            annotation: annotationOf(t),
            connector: parseViewState(t)?.connectors?.ConnectorLocation,
          };
          for (const p of t.children) {
            if (!isPropertyOf(p, t)) continue;
            const ps = suffixOf(p, t);
            if (ps === 'To') tr.to = p.children.map(visit).find(Boolean) ?? tr.to;
            else if (ps === 'Trigger') tr.trigger = firstActivity(p, ctx);
            else if (ps === 'Action') tr.action = firstActivity(p, ctx);
            else if (ps === 'Condition') tr.condition = p.children.map((x) => valueText(x, ctx)).join(' ') || p.text;
          }
          sm.transitions.push(tr);
        }
      }
    }
    return id;
  };

  for (const c of el.children) {
    if (isPropertyOf(c, el)) {
      const suffix = suffixOf(c, el);
      if (suffix === 'InitialState') sm.initialState = c.children.map(visit).find(Boolean);
      else if (suffix === 'Variables') sm.variables.push(...parseVariables(c, sm.displayName, ctx));
    } else if (!isAttached(c, el)) {
      visit(c);
    }
  }
  const dangling = sm.transitions.filter((t) => !byId.has(t.to));
  if (dangling.length) {
    ctx.warnings.push(`State machine "${sm.displayName}" has ${dangling.length} transition(s) without a target state — the XAML references names that are not defined. Open and save the workflow in Studio to repair it.`);
    sm.transitions = sm.transitions.filter((t) => byId.has(t.to));
  }
  return sm;
}

function parseArguments(root: XElement): WorkflowArgument[] {
  const members = root.children.find((c) => c.name === 'x:Members');
  if (!members) return [];
  const className = root.attrs['x:Class'];
  return members.children
    .filter((p) => localOf(p.name) === 'Property')
    .map((p) => {
      const rawType = p.attrs.Type ?? '';
      const m = rawType.match(/^(InArgument|OutArgument|InOutArgument)\((.*)\)$/);
      const direction: ArgumentDirection = m ? (m[1].replace('Argument', '') as ArgumentDirection) : 'Property';
      const name = p.attrs.Name ?? '(unnamed)';
      const defaultAttr = className ? Object.entries(root.attrs).find(([k]) => k.endsWith(`${className.split('.').pop()}.${name}`))?.[1] : undefined;
      return {
        name,
        direction,
        type: typeName(m ? m[2] : rawType),
        defaultValue: defaultAttr ? decodeEntities(defaultAttr) : undefined,
        annotation: annotationOf(p),
      };
    });
}

/**
 * Reads the workflow's imported namespaces. Current Studio versions keep them in
 * `TextExpression.NamespacesForImplementation`; older VB workflows in `VisualBasic.Settings`.
 */
function parseImports(root: XElement): string[] {
  const found = new Set<string>();
  const holder = childBySuffix(root, 'TextExpression.NamespacesForImplementation');
  for (const list of holder?.children ?? []) for (const item of list.children) if (item.text) found.add(item.text.trim());
  const visit = (e: XElement) => {
    if (localOf(e.name) === 'VisualBasicImportReference' && e.attrs.Import) found.add(e.attrs.Import.trim());
    e.children.forEach(visit);
  };
  root.children.filter((c) => c.name.endsWith('VisualBasic.Settings')).forEach(visit);
  return [...found].sort((a, b) => a.localeCompare(b));
}

/** Parses a UiPath `.xaml` workflow. Throws only when the file is not XML; everything else becomes a warning. */
export function parseWorkflow(source: string): WorkflowDocument {
  const root = parseXml(source);
  const ns: Record<string, string> = {};
  for (const [k, v] of Object.entries(root.attrs)) {
    if (k === 'xmlns') ns[''] = v;
    else if (k.startsWith('xmlns:')) ns[k.slice(6)] = v;
  }
  const ctx = new Context(ns);
  const doc: WorkflowDocument = {
    className: root.attrs['x:Class'],
    imports: parseImports(root),
    expressionLanguage: 'Unknown',
    arguments: parseArguments(root),
    warnings: ctx.warnings,
  };
  if (localOf(root.name) !== 'Activity') {
    ctx.warnings.push(`Root element is <${root.name}>, not <Activity> — this may not be a UiPath workflow. The view shows it as a single activity.`);
    doc.root = parseActivity(root, ctx);
  } else {
    const body = root.children.find((c) => c.name !== 'x:Members' && !localOf(c.name).includes('.') && !isValueElement(c, ctx));
    if (body) {
      try {
        doc.root = parseActivity(body, ctx);
      } catch (e) {
        ctx.warnings.push(`Could not read the workflow body — ${(e as Error).message}. Report the file structure as an issue on GitHub.`);
      }
    }
    doc.annotation = annotationOf(root);
  }
  const editor = attrBySuffix(root, 'ExpressionActivityEditor.ExpressionActivityEditor');
  if (editor === 'C#' || ctx.usesCSharp) doc.expressionLanguage = 'CSharp';
  // Without a C# marker the workflow uses VB, Studio's default for Windows-Legacy and Windows projects.
  else if (localOf(root.name) === 'Activity') doc.expressionLanguage = 'VisualBasic';
  return doc;
}
