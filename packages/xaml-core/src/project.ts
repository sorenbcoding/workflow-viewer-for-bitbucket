import type { ActivityNode, InvokeReference, WorkflowDocument } from './model.js';

export interface ProjectDependency {
  name: string;
  /** Version range as written, e.g. `[23.10.3]`. */
  version: string;
}

export interface ProjectEntryPoint {
  filePath: string;
  uniqueId?: string;
}

export interface UiPathProject {
  name: string;
  description?: string;
  /** `Process`, `Library`, `Tests` or another output type from `designOptions.outputType`. */
  outputType: string;
  /** `Windows`, `Legacy` or `Portable` (cross-platform). */
  targetFramework: string;
  expressionLanguage: string;
  studioVersion?: string;
  projectVersion?: string;
  main?: string;
  entryPoints: ProjectEntryPoint[];
  dependencies: ProjectDependency[];
  /** Test case files from `designOptions.fileInfoCollection`. */
  testCases: string[];
}

/** Parses a UiPath `project.json`. Throws with a readable message when the JSON is invalid. */
export function parseProjectJson(source: string): UiPathProject {
  let raw: Record<string, any>;
  try {
    raw = JSON.parse(source.replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`Could not read project.json — the file is not valid JSON (${(e as Error).message}). Open the project in Studio to repair it.`);
  }
  const design = raw.designOptions ?? {};
  const entryPoints: ProjectEntryPoint[] = Array.isArray(raw.entryPoints)
    ? raw.entryPoints.map((e: any) => ({ filePath: normalisePath(String(e.filePath ?? '')), uniqueId: e.uniqueId }))
    : [];
  const main = raw.main ? normalisePath(String(raw.main)) : undefined;
  if (main && !entryPoints.some((e) => e.filePath === main)) entryPoints.unshift({ filePath: main });
  return {
    name: String(raw.name ?? '(unnamed project)'),
    description: raw.description || undefined,
    outputType: String(design.outputType ?? (raw.projectType === 'Library' ? 'Library' : 'Process')),
    targetFramework: String(raw.targetFramework ?? 'Legacy'),
    expressionLanguage: String(raw.expressionLanguage ?? 'VisualBasic'),
    studioVersion: raw.studioVersion,
    projectVersion: raw.projectVersion,
    main,
    entryPoints,
    dependencies: Object.entries(raw.dependencies ?? {})
      .map(([name, version]) => ({ name, version: String(version) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    testCases: Array.isArray(design.fileInfoCollection)
      ? design.fileInfoCollection.map((f: any) => normalisePath(String(f.fileName ?? ''))).filter(Boolean)
      : [],
  };
}

/** Converts Windows separators and removes `./` and `..` segments. */
export function normalisePath(path: string): string {
  const out: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** Joins a project root and a project-relative path, e.g. (`Invoices`, `Framework\\Init.xaml`). */
export function joinPath(root: string, relative: string): string {
  return normalisePath(root ? `${root}/${relative}` : relative);
}

/** Directory part of a path, `''` for a file at the root. */
export function dirOf(path: string): string {
  const p = normalisePath(path);
  return p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
}

/** Visits every activity in the tree, including flowchart steps, states and transitions. */
export function walkActivities(node: ActivityNode | undefined, visit: (n: ActivityNode) => void): void {
  if (!node) return;
  visit(node);
  if (node.kind === 'activity') node.slots.forEach((s) => s.children.forEach((c) => walkActivities(c, visit)));
  else if (node.kind === 'flowchart') node.nodes.forEach((n) => walkActivities(n.activity, visit));
  else {
    node.states.forEach((s) => {
      walkActivities(s.entry, visit);
      walkActivities(s.exit, visit);
    });
    node.transitions.forEach((t) => {
      walkActivities(t.trigger, visit);
      walkActivities(t.action, visit);
    });
  }
}

/**
 * Removes the `[...]` wrapper of a VB expression. Only strips when the first `[` closes at the last `]`,
 * so a value such as `["a"] [18]` is left as it is. Brackets inside string literals are ignored.
 */
export function formatExpression(value: string): string {
  const v = value.trim();
  if (!v.startsWith('[') || !v.endsWith(']')) return v;
  let depth = 0;
  let inString = false;
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (ch === '"') inString = !inString;
    else if (inString) continue;
    else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0 && i < v.length - 1) return v;
  }
  return v.slice(1, -1).trim();
}

/** Target of an Invoke Workflow File activity, or undefined for any other activity. */
export function invokeOf(n: ActivityNode): InvokeReference | undefined {
  if (n.localType !== 'InvokeWorkflowFile') return undefined;
  const raw = n.properties.WorkflowFileName ?? '';
  const expr = formatExpression(raw);
  const literal = raw.trim().startsWith('[') ? expr.match(/^"([^"]+)"$/)?.[1] : expr;
  return {
    activityId: n.id,
    displayName: n.displayName,
    target: literal ? normalisePath(literal) : expr,
    isDynamic: !literal,
  };
}

/** Finds every Invoke Workflow File activity and its target path. */
export function findInvokes(doc: WorkflowDocument): InvokeReference[] {
  const result: InvokeReference[] = [];
  walkActivities(doc.root, (n) => {
    const inv = invokeOf(n);
    if (inv) result.push(inv);
  });
  return result;
}

export interface InvokeTreeNode {
  path: string;
  /** False when the target file is not in the project. */
  exists: boolean;
  /** True when the path is already on the current branch of the tree (a recursive invoke). */
  isCycle: boolean;
  isDynamic: boolean;
  /** True when the workflow's invokes are already expanded elsewhere in this tree. */
  isRepeat?: boolean;
  /** True when the tree reached its node limit before this workflow's invokes were expanded. */
  isTruncated?: boolean;
  children: InvokeTreeNode[];
}

/**
 * Builds the call tree from an entry point.
 * `workflows` maps project-relative paths (forward slashes) to parsed documents.
 * Each workflow's invokes are expanded once per tree; later occurrences are marked `isRepeat`.
 * Without this, workflows invoked from many places make the tree grow exponentially.
 */
export function buildInvokeTree(entry: string, workflows: Map<string, WorkflowDocument>, maxDepth = 25, maxNodes = 2000): InvokeTreeNode {
  const lower = new Map([...workflows.keys()].map((k) => [k.toLowerCase(), k]));
  const expanded = new Set<string>();
  let count = 0;
  const build = (path: string, trail: string[], dynamic: boolean): InvokeTreeNode => {
    count += 1;
    const key = lower.get(path.toLowerCase()) ?? path;
    const doc = workflows.get(key);
    const node: InvokeTreeNode = { path: key, exists: !!doc, isCycle: trail.includes(key), isDynamic: dynamic, children: [] };
    if (!doc || node.isCycle || dynamic || trail.length >= maxDepth) return node;
    if (expanded.has(key)) {
      if (findInvokes(doc).length > 0) node.isRepeat = true;
      return node;
    }
    if (count >= maxNodes) {
      node.isTruncated = true;
      return node;
    }
    expanded.add(key);
    const seen = new Set<string>();
    for (const inv of findInvokes(doc)) {
      const id = `${inv.isDynamic}:${inv.target}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (count >= maxNodes) {
        node.isTruncated = true;
        break;
      }
      node.children.push(build(inv.target, [...trail, key], inv.isDynamic));
    }
    return node;
  };
  return build(normalisePath(entry), [], false);
}
