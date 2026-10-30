import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  formatExpression,
  invokeOf,
  type ActivityNode,
  type Assignment,
  type FlowchartActivity,
  type StateMachineActivity,
  type WorkflowVariable,
} from '@sorenb/xaml-core';
import { ActivityIcon, familyOf, summaryOf } from './icons.js';
import { GraphCanvas, type GraphEdge, type GraphNode } from './graph.js';

/** What the properties panel shows. */
export interface Selection {
  id: string;
  title: string;
  type: string;
  /** Full .NET type, e.g. `UiPath.Core.Activities.LogMessage`. */
  fullType?: string;
  fullTypeInferred?: boolean;
  annotation?: string;
  properties: Record<string, string>;
  variables?: WorkflowVariable[];
  /** Rows of a Multiple Assign; shown as a table instead of the AssignOperations property. */
  assignments?: Assignment[];
}

export const selectionOf = (n: ActivityNode): Selection => ({
  id: n.id,
  title: n.displayName,
  type: n.type,
  fullType: n.fullType,
  fullTypeInferred: n.fullTypeInferred,
  annotation: n.annotation,
  properties: n.properties,
  variables: n.variables,
  assignments: n.kind === 'activity' ? n.assignments : undefined,
});

interface ViewerState {
  selectedId?: string;
  select: (s: Selection) => void;
  onOpenInvoke?: (target: string) => void;
  /** Bumped by Expand all / Collapse all. */
  expand: { open: boolean; n: number };
}

export const ViewerContext = createContext<ViewerState>({ select: () => {}, expand: { open: true, n: 0 } });
const useViewer = () => useContext(ViewerContext);

const ASSIGN_PREVIEW_ROWS = 8;

/** Multiple Assign rows on the canvas, one `To = Value` per row, like Studio's designer. */
function AssignRows({ rows }: { rows: Assignment[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, ASSIGN_PREVIEW_ROWS);
  return (
    <div className="sbv-assign-wrap">
      <div className="sbv-assign" role="table" aria-label="Assignments">
        {shown.map((r, i) => {
          const to = formatExpression(r.to);
          const value = formatExpression(r.value);
          return (
            <div key={i} className="sbv-assign__row" role="row">
              <span className="sbv-assign__to" role="cell" title={to}>{to}</span>
              <span className="sbv-assign__eq" aria-hidden="true">=</span>
              <span className="sbv-assign__value" role="cell" title={value}>{value}</span>
            </div>
          );
        })}
      </div>
      {rows.length > ASSIGN_PREVIEW_ROWS && (
        <button type="button" className="sbv-link sbv-assign__more" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d={open ? 'M4 6l4 4 4-4' : 'M6 4l4 4-4 4'} />
    </svg>
  );
}

export function ActivityBlock({ node, depth = 0 }: { node: ActivityNode; depth?: number }) {
  const { selectedId, select, onOpenInvoke, expand } = useViewer();
  const assignments = node.kind === 'activity' && node.assignments?.length ? node.assignments : undefined;
  const hasBody = node.kind !== 'activity' || node.slots.some((s) => s.children.length > 0) || !!assignments;
  const [open, setOpen] = useState(depth < 8);
  useEffect(() => {
    if (expand.n > 0) setOpen(expand.open);
  }, [expand]);

  const invoke = invokeOf(node);
  const summary = summaryOf(node);
  const family = familyOf(node.localType);
  const selected = selectedId === node.id;
  const split = node.kind === 'activity' && node.localType === 'If' && node.slots.filter((s) => s.name === 'Then' || s.name === 'Else').length === 2;

  return (
    <div className={`sbv-act${selected ? ' is-selected' : ''}`} data-family={family}>
      <div className="sbv-act__head">
        {hasBody ? (
          <button type="button" className="sbv-act__toggle" aria-expanded={open} aria-label={open ? `Collapse ${node.displayName}` : `Expand ${node.displayName}`} onClick={() => setOpen(!open)}>
            <Chevron open={open} />
          </button>
        ) : (
          <span className="sbv-act__toggle-spacer" />
        )}
        <button type="button" className="sbv-act__title" onClick={() => select(selectionOf(node))} aria-pressed={selected}>
          <ActivityIcon family={family} />
          <span className="sbv-act__name">{node.displayName}</span>
          {node.displayName !== node.localType && <span className="sbv-act__type">{node.localType}</span>}
        </button>
        {invoke && onOpenInvoke && !invoke.isDynamic && (
          <button type="button" className="sbv-link" onClick={() => onOpenInvoke(invoke.target)} title={`Open ${invoke.target}`}>
            Open
          </button>
        )}
      </div>
      {summary && !(assignments && open) && <div className="sbv-act__summary">{summary}</div>}
      {node.annotation && <div className="sbv-act__note">{node.annotation}</div>}
      {hasBody && open && (
        <div className="sbv-act__body">
          {node.kind === 'flowchart' && <FlowchartView fc={node} depth={depth} />}
          {node.kind === 'stateMachine' && <StateMachineView sm={node} depth={depth} />}
          {assignments && <AssignRows rows={assignments} />}
          {node.kind === 'activity' && node.slots.length > 0 && (
            <div className={split ? 'sbv-slots sbv-slots--split' : 'sbv-slots'}>
              {node.slots.map((slot) => (
                <section key={slot.name || '_'} className="sbv-slot" aria-label={slot.name || undefined}>
                  {slot.name && (
                    <div className="sbv-slot__label">
                      {slot.name}
                      {slot.argument && <span className="sbv-slot__arg"> · {slot.argument}</span>}
                    </div>
                  )}
                  <div className="sbv-slot__children">
                    {slot.children.length ? slot.children.map((c) => <ActivityBlock key={c.id} node={c} depth={depth + 1} />) : <div className="sbv-muted sbv-empty">No activities</div>}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlowchartView({ fc, depth }: { fc: FlowchartActivity; depth: number }) {
  const [current, setCurrent] = useState<string>();
  const { select } = useViewer();
  const { nodes, edges } = useMemo(() => {
    const nodes: GraphNode[] = fc.nodes.map((n) => ({
      id: n.id,
      label: n.displayName,
      shape: n.kind,
      family: n.activity ? familyOf(n.activity.localType) : familyOf(n.kind === 'decision' ? 'FlowDecision' : 'FlowSwitch'),
      x: n.viewState?.location?.x,
      y: n.viewState?.location?.y,
      w: n.viewState?.size?.width,
      h: n.viewState?.size?.height,
    }));
    const edges: GraphEdge[] = fc.edges.map((e) => {
      const src = fc.nodes.find((n) => n.id === e.from);
      return { from: e.from, to: e.to, label: e.label, points: e.connectorKey ? src?.viewState?.connectors?.[e.connectorKey] : undefined };
    });
    const start = fc.viewState?.location;
    nodes.unshift({ id: `${fc.id}__start`, label: 'Start', shape: 'start', family: 'flow', x: start?.x, y: start?.y, w: fc.viewState?.size?.width, h: fc.viewState?.size?.height });
    if (fc.startNode) edges.unshift({ from: `${fc.id}__start`, to: fc.startNode, points: fc.viewState?.connectors?.ConnectorLocation });
    return { nodes, edges };
  }, [fc]);

  const node = fc.nodes.find((n) => n.id === current);
  const onSelect = (id: string) => {
    setCurrent(id);
    const n = fc.nodes.find((x) => x.id === id);
    if (!n) return;
    if (n.activity) select(selectionOf(n.activity));
    else
      select({
        id: n.id,
        title: n.displayName,
        type: n.kind === 'decision' ? 'FlowDecision' : 'FlowSwitch',
        fullType: `System.Activities.Statements.${n.kind === 'decision' ? 'FlowDecision' : 'FlowSwitch'}`,
        annotation: n.annotation,
        properties: n.expression ? { [n.kind === 'decision' ? 'Condition' : 'Expression']: n.expression } : {},
      });
  };

  return (
    <div className="sbv-graph-wrap">
      <GraphCanvas nodes={nodes} edges={edges} startId={`${fc.id}__start`} selectedId={current} onSelect={onSelect} ariaLabel={`Flowchart ${fc.displayName}`} />
      {node?.activity && (
        <div className="sbv-graph-detail">
          <div className="sbv-slot__label">Selected step</div>
          <ActivityBlock node={node.activity} depth={depth + 1} />
        </div>
      )}
      {node && !node.activity && node.expression && (
        <div className="sbv-graph-detail">
          <div className="sbv-slot__label">{node.kind === 'decision' ? 'Condition' : 'Expression'}</div>
          <code className="sbv-code">{formatExpression(node.expression)}</code>
        </div>
      )}
    </div>
  );
}

function StateMachineView({ sm, depth }: { sm: StateMachineActivity; depth: number }) {
  const [current, setCurrent] = useState<string>();
  const { select } = useViewer();
  const { nodes, edges } = useMemo(
    () => ({
      nodes: sm.states.map<GraphNode>((s) => ({
        id: s.id,
        label: s.displayName,
        shape: s.isFinal ? 'final' : 'state',
        family: 'flow',
        x: s.viewState?.location?.x,
        y: s.viewState?.location?.y,
        w: s.viewState?.size?.width,
        h: s.viewState?.size?.height,
      })),
      edges: sm.transitions.map<GraphEdge>((t) => ({ from: t.from, to: t.to, label: t.displayName, points: t.connector })),
    }),
    [sm],
  );
  const state = sm.states.find((s) => s.id === current);
  const outgoing = sm.transitions.filter((t) => t.from === current);
  const nameOf = (id: string) => sm.states.find((s) => s.id === id)?.displayName ?? id;

  const onSelect = (id: string) => {
    setCurrent(id);
    const s = sm.states.find((x) => x.id === id);
    if (s) select({
        id: s.id,
        title: s.displayName,
        type: s.isFinal ? 'Final State' : 'State',
        fullType: 'System.Activities.Statements.State',
        annotation: s.annotation,
        properties: {},
      });
  };

  return (
    <div className="sbv-graph-wrap">
      <GraphCanvas nodes={nodes} edges={edges} startId={sm.initialState} selectedId={current} onSelect={onSelect} ariaLabel={`State machine ${sm.displayName}`} />
      {state && (
        <div className="sbv-graph-detail">
          <div className="sbv-slot__label">Entry</div>
          {state.entry ? <ActivityBlock node={state.entry} depth={depth + 1} /> : <div className="sbv-muted sbv-empty">No entry activities</div>}
          {state.exit && (
            <>
              <div className="sbv-slot__label">Exit</div>
              <ActivityBlock node={state.exit} depth={depth + 1} />
            </>
          )}
          {outgoing.length > 0 && (
            <>
              <div className="sbv-slot__label">Transitions</div>
              <ul className="sbv-transitions">
                {outgoing.map((t) => (
                  <li key={t.id}>
                    <strong>{t.displayName}</strong> to {nameOf(t.to)}
                    {t.condition && <code className="sbv-code"> when {formatExpression(t.condition)}</code>}
                    {t.trigger && <div className="sbv-transitions__part"><span className="sbv-muted">Trigger</span><ActivityBlock node={t.trigger} depth={depth + 2} /></div>}
                    {t.action && <div className="sbv-transitions__part"><span className="sbv-muted">Action</span><ActivityBlock node={t.action} depth={depth + 2} /></div>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PropertiesPanel({ selection }: { selection?: Selection }) {
  if (!selection) {
    return (
      <aside className="sbv-panel" aria-label="Properties">
        <h2 className="sbv-panel__title">Properties</h2>
        <p className="sbv-muted">Select an activity to see its properties.</p>
      </aside>
    );
  }
  const entries = Object.entries(selection.properties).filter(([k]) => !(selection.assignments && k === 'AssignOperations'));
  return (
    <aside className="sbv-panel" aria-label="Properties">
      <h2 className="sbv-panel__title">{selection.title}</h2>
      <div className="sbv-panel__type">{selection.type}</div>
      {selection.fullType && (
        <div className="sbv-panel__fulltype" title={selection.fullTypeInferred ? 'Inferred from the XAML namespace; the package may use a different namespace.' : undefined}>
          {selection.fullType.split('.').map((part, i) => (
            <span key={i}>{i > 0 && <>.<wbr /></>}{part}</span>
          ))}
        </div>
      )}
      {selection.annotation && <p className="sbv-act__note">{selection.annotation}</p>}
      {entries.length > 0 ? (
        <dl className="sbv-props">
          {entries.map(([k, v]) => (
            <div key={k} className="sbv-props__row">
              <dt>{k}</dt>
              <dd>
                {v.includes('\n') ? (
                  <ul className="sbv-lines">
                    {v.split('\n').map((line, i) => <li key={i}><code className="sbv-code">{formatExpression(line)}</code></li>)}
                  </ul>
                ) : (
                  <code className="sbv-code">{formatExpression(v)}</code>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        !selection.assignments?.length && <p className="sbv-muted">No properties set.</p>
      )}
      {selection.assignments && selection.assignments.length > 0 && (
        <>
          <h3 className="sbv-panel__sub">Assignments <span className="sbv-count">{selection.assignments.length}</span></h3>
          <table className="sbv-table sbv-assign-table">
            <thead><tr><th>To</th><th>Value</th></tr></thead>
            <tbody>
              {selection.assignments.map((r, i) => (
                <tr key={i}>
                  <td><code className="sbv-code">{formatExpression(r.to)}</code></td>
                  <td><code className="sbv-code">{formatExpression(r.value)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {selection.variables && selection.variables.length > 0 && (
        <>
          <h3 className="sbv-panel__sub">Variables in this scope</h3>
          <dl className="sbv-props">
            {selection.variables.map((v) => (
              <div key={v.name} className="sbv-props__row">
                <dt>{v.name}</dt>
                <dd><code className="sbv-code">{v.type}{v.defaultValue ? ` = ${formatExpression(v.defaultValue)}` : ''}</code></dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </aside>
  );
}
