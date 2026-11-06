import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildInvokeTree,
  dirOf,
  findInvokes,
  joinPath,
  parseProjectJson,
  parseWorkflow,
  type InvokeTreeNode,
  type UiPathProject,
  type WorkflowDocument,
} from '@sorenb/xaml-core';
import { WorkflowView } from './WorkflowView.js';

/** Where the overview reads files from: the Bitbucket API, a local folder or bundled samples. */
export interface RepoSource {
  /** Every file path in the repository, with forward slashes and no leading slash. */
  listFiles(): Promise<string[]>;
  readText(path: string): Promise<string>;
}

interface Props {
  source: RepoSource;
  /** Content shown above the project, e.g. a branch picker. */
  toolbar?: ReactNode;
  /** Number of files read in parallel. */
  concurrency?: number;
  /** Most workflows read when the overview opens; the rest are read when opened. Entry points are read first. */
  maxFiles?: number;
}

interface LoadedProject {
  root: string;
  project?: UiPathProject;
  projectError?: string;
  /** Project-relative workflow paths to parsed documents. */
  workflows: Map<string, WorkflowDocument>;
  errors: Map<string, string>;
  /** Project-relative paths of workflows not read yet because of `maxFiles`. */
  unread: string[];
}

const IGNORED = /(^|\/)\.(local|objects|settings|screenshots|tmh|templates)\//;

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function InvokeTree({ node, onOpen, unread }: { node: InvokeTreeNode; onOpen: (path: string) => void; unread: Set<string> }) {
  const notRead = !node.exists && unread.has(node.path.toLowerCase());
  return (
    <li>
      {(node.exists || notRead) && !node.isCycle ? (
        <button type="button" className="sbv-link" onClick={() => onOpen(node.path)}>{node.path}</button>
      ) : (
        <code className="sbv-code">{node.path}</code>
      )}
      {node.isDynamic && <span className="sbv-tag">Dynamic path</span>}
      {notRead && <span className="sbv-tag" title="Not read yet. Open it to read it and see what it invokes.">Not read</span>}
      {!node.exists && !notRead && !node.isDynamic && <span className="sbv-tag sbv-tag--error">Missing file</span>}
      {node.isCycle && <span className="sbv-tag">Recursive</span>}
      {node.children.length > 0 && (
        <ul className="sbv-tree">
          {node.children.map((c, i) => <InvokeTree key={`${c.path}-${i}`} node={c} onOpen={onOpen} unread={unread} />)}
        </ul>
      )}
    </li>
  );
}

export function ProjectOverview({ source, toolbar, concurrency = 6, maxFiles = 300 }: Props) {
  const [files, setFiles] = useState<string[]>();
  const [listError, setListError] = useState<string>();
  const [root, setRoot] = useState<string>();
  const [loaded, setLoaded] = useState<LoadedProject>();
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [openPath, setOpenPath] = useState<string>();
  const [openError, setOpenError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setFiles(undefined);
    setListError(undefined);
    setLoaded(undefined);
    setOpenPath(undefined);
    source
      .listFiles()
      .then((f) => {
        if (cancelled) return;
        setFiles(f);
        const roots = f.filter((p) => p === 'project.json' || p.endsWith('/project.json')).map(dirOf);
        setRoot(roots.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))[0] ?? '');
      })
      .catch((e: Error) => !cancelled && setListError(e.message));
    return () => {
      cancelled = true;
    };
  }, [source]);

  const projectRoots = useMemo(() => (files ?? []).filter((p) => p === 'project.json' || p.endsWith('/project.json')).map(dirOf).sort(), [files]);

  useEffect(() => {
    if (!files || root === undefined) return;
    let cancelled = false;
    const prefix = root ? `${root}/` : '';
    // A nested project's files belong to that project, not to this one.
    const nested = projectRoots.filter((r) => r !== root && (root === '' || r.startsWith(prefix)));
    const xaml = files.filter(
      (p) => p.toLowerCase().endsWith('.xaml') && p.startsWith(prefix) && !IGNORED.test(p) && !nested.some((n) => p.startsWith(`${n}/`)),
    );
    const result: LoadedProject = { root, workflows: new Map(), errors: new Map(), unread: [] };
    setLoaded(undefined);
    setProgress([0, Math.min(xaml.length, maxFiles)]);
    (async () => {
      if (projectRoots.includes(root)) {
        try {
          result.project = parseProjectJson(await source.readText(joinPath(root, 'project.json')));
        } catch (e) {
          result.projectError = (e as Error).message;
        }
      }
      // Entry points first, so the call tree is complete as far as the limit allows.
      const entries = new Set((result.project?.entryPoints ?? []).map((e) => joinPath(root, e.filePath).toLowerCase()));
      const ordered = [...xaml].sort((a, b) => Number(entries.has(b.toLowerCase())) - Number(entries.has(a.toLowerCase())) || a.localeCompare(b));
      const toRead = ordered.slice(0, maxFiles);
      result.unread = ordered.slice(maxFiles).map((p) => p.slice(prefix.length));
      let done = 0;
      await mapLimit(toRead, concurrency, async (p) => {
        const rel = p.slice(prefix.length);
        try {
          result.workflows.set(rel, parseWorkflow(await source.readText(p)));
        } catch (e) {
          result.errors.set(rel, (e as Error).message);
        }
        done += 1;
        if (!cancelled) setProgress([done, toRead.length]);
      });
      if (!cancelled) setLoaded(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [files, root, source, projectRoots, concurrency, maxFiles]);

  /** Opens a workflow, reading it first when it was left out by `maxFiles`. */
  const open = async (path: string) => {
    setOpenError(undefined);
    if (!loaded) return;
    const known = [...loaded.workflows.keys()].find((k) => k.toLowerCase() === path.toLowerCase());
    if (known) return setOpenPath(known);
    const pending = loaded.unread.find((u) => u.toLowerCase() === path.toLowerCase());
    if (!pending) return setOpenPath(path);
    try {
      const doc = parseWorkflow(await source.readText(joinPath(loaded.root, pending)));
      setLoaded({ ...loaded, workflows: new Map(loaded.workflows).set(pending, doc), unread: loaded.unread.filter((u) => u !== pending) });
      setOpenPath(pending);
    } catch (e) {
      setOpenError((e as Error).message);
    }
  };

  const analysis = useMemo(() => {
    if (!loaded) return undefined;
    const entries = loaded.project?.entryPoints.map((e) => e.filePath) ?? [];
    const tests = loaded.project?.testCases ?? [];
    const trees = entries.map((e) => buildInvokeTree(e, loaded.workflows));
    const reached = new Set<string>();
    const mark = (n: InvokeTreeNode) => {
      reached.add(n.path.toLowerCase());
      n.children.forEach(mark);
    };
    [...trees, ...tests.map((t) => buildInvokeTree(t, loaded.workflows))].forEach(mark);
    const rows = [...loaded.workflows.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, doc]) => ({
        path,
        doc,
        invokes: findInvokes(doc).length,
        isEntry: entries.some((e) => e.toLowerCase() === path.toLowerCase()),
        isTest: tests.some((t) => t.toLowerCase() === path.toLowerCase()),
        reached: reached.has(path.toLowerCase()),
      }));
    return { trees, rows };
  }, [loaded]);
  const unreadSet = useMemo(() => new Set((loaded?.unread ?? []).map((u) => u.toLowerCase())), [loaded]);

  if (listError) return <p className="sbv-error" role="alert">{listError}</p>;
  if (!files) return <p className="sbv-muted" role="status">Reading the repository file list…</p>;

  if (loaded && openPath && loaded.workflows.has(openPath)) {
    const doc = loaded.workflows.get(openPath)!;
    return (
      <WorkflowView
        key={openPath}
        doc={doc}
        path={joinPath(loaded.root, openPath)}
        onOpenInvoke={(target) => void open(target)}
        actions={<button type="button" className="sbv-btn" onClick={() => setOpenPath(undefined)}>Back to project</button>}
      />
    );
  }

  const project = loaded?.project;
  return (
    <div className="sbv-project">
      {toolbar}
      {projectRoots.length > 1 && (
        <label className="sbv-field">
          <span>Project</span>
          <select value={root} onChange={(e) => setRoot(e.target.value)}>
            {projectRoots.map((r) => <option key={r} value={r}>{r || '(repository root)'}</option>)}
          </select>
        </label>
      )}
      {projectRoots.length === 0 && (
        <p className="sbv-warning" role="status">
          No project.json found — this repository does not look like a UiPath project. The workflows below are listed without entry points.
        </p>
      )}
      {!loaded ? (
        <p className="sbv-muted" role="status">Reading workflows… {progress[0]} of {progress[1]}</p>
      ) : (
        <>
          <header className="sbv-header">
            <div className="sbv-header__main">
              <h1 className="sbv-title">{project?.name ?? (root || 'Repository')}</h1>
              {project && (
                <div className="sbv-chips">
                  <span className="sbv-chip">{project.outputType}</span>
                  <span className="sbv-chip">{project.targetFramework === 'Portable' ? 'Cross-platform' : project.targetFramework}</span>
                  <span className="sbv-chip">{project.expressionLanguage === 'CSharp' ? 'C#' : 'VB'}</span>
                  {project.projectVersion && <span className="sbv-chip">v{project.projectVersion}</span>}
                  {project.studioVersion && <span className="sbv-chip">Studio {project.studioVersion}</span>}
                </div>
              )}
            </div>
          </header>
          {project?.description && <p>{project.description}</p>}
          {loaded.projectError && <p className="sbv-error" role="alert">{loaded.projectError}</p>}
          {openError && <p className="sbv-error" role="alert">{openError}</p>}
          {loaded.unread.length > 0 && (
            <p className="sbv-warning" role="status">
              Read {loaded.workflows.size + loaded.errors.size} of {loaded.workflows.size + loaded.errors.size + loaded.unread.length} workflows — the
              project is larger than the overview reads at once. Open a workflow marked Not read to read it.
            </p>
          )}

          {analysis && analysis.trees.length > 0 && (
            <section className="sbv-card">
              <h2 className="sbv-card__title">Entry points and invoked workflows</h2>
              <ul className="sbv-tree sbv-tree--root">
                {analysis.trees.map((t) => <InvokeTree key={t.path} node={t} onOpen={(p) => void open(p)} unread={unreadSet} />)}
              </ul>
            </section>
          )}

          <section className="sbv-card">
            <h2 className="sbv-card__title">Workflows <span className="sbv-count">{loaded.workflows.size + loaded.errors.size + loaded.unread.length}</span></h2>
            <table className="sbv-table">
              <thead><tr><th>File</th><th>Arguments</th><th>Invokes</th><th>Status</th></tr></thead>
              <tbody>
                {analysis?.rows.map((r) => (
                  <tr key={r.path}>
                    <td><button type="button" className="sbv-link" onClick={() => void open(r.path)}>{r.path}</button></td>
                    <td>{r.doc.arguments.length}</td>
                    <td>{r.invokes}</td>
                    <td>
                      {r.isEntry && <span className="sbv-tag">Entry point</span>}
                      {r.isTest && <span className="sbv-tag">Test case</span>}
                      {!r.reached && project && loaded.unread.length === 0 && <span className="sbv-tag" title="No entry point or test case invokes this workflow with a static path.">Not invoked</span>}
                      {r.doc.warnings.length > 0 && <span className="sbv-tag sbv-tag--warning" title={r.doc.warnings.join('\n')}>{r.doc.warnings.length} warning(s)</span>}
                    </td>
                  </tr>
                ))}
                {loaded.unread.map((path) => (
                  <tr key={path}>
                    <td><button type="button" className="sbv-link" onClick={() => void open(path)}>{path}</button></td>
                    <td colSpan={3}><span className="sbv-tag">Not read</span></td>
                  </tr>
                ))}
                {[...loaded.errors.entries()].map(([path, message]) => (
                  <tr key={path}>
                    <td><code className="sbv-code">{path}</code></td>
                    <td colSpan={3}><span className="sbv-tag sbv-tag--error">Not readable</span> {message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {project && (
            <section className="sbv-card">
              <h2 className="sbv-card__title">Dependencies <span className="sbv-count">{project.dependencies.length}</span></h2>
              <table className="sbv-table">
                <thead><tr><th>Package</th><th>Version</th></tr></thead>
                <tbody>
                  {project.dependencies.map((d) => (
                    <tr key={d.name}><td><code className="sbv-code">{d.name}</code></td><td><code className="sbv-code">{d.version}</code></td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
