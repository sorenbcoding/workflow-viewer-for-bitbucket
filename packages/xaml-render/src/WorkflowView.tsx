import { useMemo, useState, type ReactNode } from 'react';
import { formatExpression, walkActivities, type WorkflowDocument, type WorkflowVariable } from '@sorenb/xaml-core';
import { ActivityBlock, PropertiesPanel, ViewerContext, type Selection } from './activity.js';

interface Props {
  doc: WorkflowDocument;
  /** File path shown as the title; falls back to the class name. */
  path?: string;
  /** Called with the project-relative path of an Invoke Workflow File target. Hides the Open links when omitted. */
  onOpenInvoke?: (target: string) => void;
  /** Extra content on the right of the title row, e.g. a Back button. */
  actions?: ReactNode;
}

const LANGUAGE: Record<WorkflowDocument['expressionLanguage'], string> = { VisualBasic: 'VB', CSharp: 'C#', Unknown: 'Unknown language' };

function Collapsible({ title, count, children, defaultOpen = false }: { title: string; count: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="sbv-section">
      <button type="button" className="sbv-section__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'}</span> {title} <span className="sbv-count">{count}</span>
      </button>
      {open && <div className="sbv-section__body">{children}</div>}
    </section>
  );
}

export function WorkflowView({ doc, path, onOpenInvoke, actions }: Props) {
  const [selection, setSelection] = useState<Selection>();
  const [expand, setExpand] = useState({ open: true, n: 0 });
  const variables = useMemo(() => {
    const all: WorkflowVariable[] = [];
    walkActivities(doc.root, (n) => all.push(...n.variables));
    return all;
  }, [doc]);
  const title = path ?? doc.className ?? 'Workflow';

  return (
    <ViewerContext.Provider value={{ selectedId: selection?.id, select: setSelection, onOpenInvoke, expand }}>
      <div className="sbv-workflow">
        <header className="sbv-header">
          <div className="sbv-header__main">
            <h1 className="sbv-title">{title}</h1>
            <div className="sbv-chips">
              {doc.className && path && <span className="sbv-chip">{doc.className}</span>}
              <span className="sbv-chip">{LANGUAGE[doc.expressionLanguage]}</span>
              {doc.root && <span className="sbv-chip">{doc.root.localType}</span>}
            </div>
          </div>
          {actions && <div className="sbv-header__actions">{actions}</div>}
        </header>
        {doc.annotation && <p className="sbv-act__note">{doc.annotation}</p>}
        {doc.warnings.map((w) => (
          <p key={w} className="sbv-warning" role="status">{w}</p>
        ))}

        <Collapsible title="Arguments" count={doc.arguments.length} defaultOpen={doc.arguments.length > 0 && doc.arguments.length <= 8}>
          {doc.arguments.length ? (
            <table className="sbv-table">
              <thead><tr><th>Name</th><th>Direction</th><th>Type</th><th>Default</th></tr></thead>
              <tbody>
                {doc.arguments.map((a) => (
                  <tr key={a.name} title={a.annotation}>
                    <td><code className="sbv-code">{a.name}</code>{a.annotation && <div className="sbv-muted">{a.annotation}</div>}</td>
                    <td>{a.direction}</td>
                    <td><code className="sbv-code">{a.type}</code></td>
                    <td>{a.defaultValue && <code className="sbv-code">{formatExpression(a.defaultValue)}</code>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="sbv-muted">This workflow has no arguments.</p>
          )}
        </Collapsible>
        <Collapsible title="Variables" count={variables.length}>
          {variables.length ? (
            <table className="sbv-table">
              <thead><tr><th>Name</th><th>Type</th><th>Scope</th><th>Default</th></tr></thead>
              <tbody>
                {variables.map((v, i) => (
                  <tr key={`${v.scope}/${v.name}/${i}`}>
                    <td><code className="sbv-code">{v.name}</code></td>
                    <td><code className="sbv-code">{v.type}</code></td>
                    <td>{v.scope}</td>
                    <td>{v.defaultValue && <code className="sbv-code">{formatExpression(v.defaultValue)}</code>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="sbv-muted">This workflow declares no variables.</p>
          )}
        </Collapsible>

        <Collapsible title="Imports" count={doc.imports.length}>
          {doc.imports.length ? (
            <ul className="sbv-lines">
              {doc.imports.map((ns) => <li key={ns}><code className="sbv-code">{ns}</code></li>)}
            </ul>
          ) : (
            <p className="sbv-muted">This workflow lists no imported namespaces.</p>
          )}
        </Collapsible>

        <div className="sbv-toolbar">
          <button type="button" className="sbv-btn" onClick={() => setExpand((e) => ({ open: true, n: e.n + 1 }))}>Expand all</button>
          <button type="button" className="sbv-btn" onClick={() => setExpand((e) => ({ open: false, n: e.n + 1 }))}>Collapse all</button>
        </div>
        <div className="sbv-layout">
          <main className="sbv-canvas" aria-label="Workflow designer">
            {doc.root ? <ActivityBlock node={doc.root} /> : <p className="sbv-muted">This workflow is empty.</p>}
          </main>
          <PropertiesPanel selection={selection} />
        </div>
      </div>
    </ViewerContext.Provider>
  );
}
