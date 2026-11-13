import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './harness.css';
import { StrictMode, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { parseWorkflow, type WorkflowDocument } from '@sorenb/xaml-core';
import { AboutFooter, Logo, PRODUCT_NAME, ProjectOverview, WorkflowView, type RepoSource } from '@sorenb/xaml-render';
import pkg from '../../../package.json';

// Synthetic samples bundled with the repository, keyed by path relative to samples/.
const SAMPLES = Object.fromEntries(
  Object.entries(import.meta.glob('../../../samples/**/*.{xaml,json}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>).map(
    ([k, v]) => [k.replace('../../../samples/', ''), v],
  ),
);

// `?truncated` makes the listing report that it stopped early, to try the warning.
const TRUNCATED = new URLSearchParams(location.search).has('truncated');

const memorySource = (files: Record<string, string>): RepoSource => ({
  listFiles: async () => ({ paths: Object.keys(files), truncated: TRUNCATED }),
  readText: async (p) => {
    if (!(p in files)) throw new Error(`Could not read ${p} — the file is not in the selected folder. Select the folder again.`);
    return files[p];
  },
});

// `?maxFiles=N` limits how many workflows the overview reads at once, to try the on-demand reading.
const MAX_FILES = Number(new URLSearchParams(location.search).get('maxFiles')) || undefined;

type View = { kind: 'project'; source: RepoSource; label: string } | { kind: 'file'; path: string; doc?: WorkflowDocument; error?: string };

function openFile(path: string, text: string): View {
  try {
    return { kind: 'file', path, doc: parseWorkflow(text) };
  } catch (e) {
    return { kind: 'file', path, error: (e as Error).message };
  }
}

async function readFiles(list: FileList | File[]): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const f of Array.from(list)) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    if (/\.(xaml|json)$/i.test(rel)) files[rel.replace(/\\/g, '/')] = await f.text();
  }
  return files;
}

function App() {
  const sampleSource = useMemo(() => memorySource(SAMPLES), []);
  const [view, setView] = useState<View>({ kind: 'project', source: sampleSource, label: 'Sample project' });
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');

  const applyTheme = (t: typeof theme) => {
    setTheme(t);
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  };

  const onFolder = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = await readFiles(e.target.files);
    setView({ kind: 'project', source: memorySource(files), label: e.target.files[0].webkitRelativePath.split('/')[0] || 'Local folder' });
  };
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find((f) => f.name.toLowerCase().endsWith('.xaml'));
    if (file) setView(openFile(file.name, await file.text()));
  };

  return (
    <div className="harness" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <nav className="harness__nav" aria-label="Samples">
        <div className="harness__brand">
          <Logo size={28} />
          <span>{PRODUCT_NAME}</span>
        </div>
        <p className="sbv-muted">Dev harness. Files stay in this browser and are not uploaded.</p>
        <button type="button" className="sbv-btn" onClick={() => setView({ kind: 'project', source: sampleSource, label: 'Sample project' })}>
          Sample project overview
        </button>
        <h2 className="harness__heading">Sample workflows</h2>
        <ul className="harness__list">
          {Object.keys(SAMPLES).filter((p) => p.endsWith('.xaml')).sort().map((p) => (
            <li key={p}>
              <button type="button" className="sbv-link" onClick={() => setView(openFile(p, SAMPLES[p]))}>{p}</button>
            </li>
          ))}
        </ul>
        <h2 className="harness__heading">Your files</h2>
        <label className="sbv-btn harness__file">
          Open a project folder
          <input type="file" onChange={onFolder} {...{ webkitdirectory: '', directory: '' }} />
        </label>
        <label className="sbv-btn harness__file">
          Open a .xaml file
          <input type="file" accept=".xaml" onChange={async (e) => e.target.files?.[0] && setView(openFile(e.target.files[0].name, await e.target.files[0].text()))} />
        </label>
        <p className="sbv-muted">Or drop a .xaml file anywhere on the page.</p>
        <label className="sbv-field">
          <span>Theme</span>
          <select value={theme} onChange={(e) => applyTheme(e.target.value as typeof theme)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </nav>
      <div className="sbv-root harness__main">
        {view.kind === 'project' ? (
          <ProjectOverview key={view.label} source={view.source} maxFiles={MAX_FILES} />
        ) : view.doc ? (
          <WorkflowView key={view.path} doc={view.doc} path={view.path} onOpenInvoke={(t) => SAMPLES[`InvoiceProcessing/${t}`] && setView(openFile(`InvoiceProcessing/${t}`, SAMPLES[`InvoiceProcessing/${t}`]))} />
        ) : (
          <p className="sbv-error" role="alert">{view.error}</p>
        )}
        <AboutFooter version={pkg.version} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
