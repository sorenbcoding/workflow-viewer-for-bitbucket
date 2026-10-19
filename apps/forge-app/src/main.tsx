import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { router, view, type FullContext } from '@forge/bridge';
import { dirOf, joinPath, parseWorkflow, type WorkflowDocument } from '@sorenb/xaml-core';
import { AboutFooter, ProjectOverview, WorkflowView } from '@sorenb/xaml-render';
import { fileExists, getBranches, readText, repoSource, type Branch, type RepoRef } from './bitbucket.js';
import pkg from '../package.json';

/** Forge sets data-color-mode on <html>; the SorenB tokens read data-theme. */
function syncTheme(): void {
  const html = document.documentElement;
  const apply = () => {
    const mode = html.getAttribute('data-color-mode');
    if (mode === 'dark' || mode === 'light') html.setAttribute('data-theme', mode);
  };
  apply();
  new MutationObserver(apply).observe(html, { attributes: true, attributeFilter: ['data-color-mode'] });
}

/** Finds the folder that holds project.json, walking up from the file. Falls back to the repository root. */
async function findProjectRoot(repo: RepoRef, commit: string, filePath: string): Promise<string> {
  let dir = dirOf(filePath);
  for (let i = 0; i < 10; i++) {
    if (await fileExists(repo, commit, joinPath(dir, 'project.json'))) return dir;
    if (!dir) break;
    dir = dirOf(dir);
  }
  return '';
}

function FileViewer({ ctx }: { ctx: FullContext }) {
  const repo: RepoRef = { workspaceId: ctx.workspaceId!, repoUuid: ctx.extension.repository.uuid };
  const path: string = ctx.extension.file.path;
  const commit: string = ctx.extension.commit.hash;
  const [doc, setDoc] = useState<WorkflowDocument>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    readText(repo, commit, path)
      .then((t) => setDoc(parseWorkflow(t)))
      .catch((e: Error) => setError(e.message));
  }, [path, commit]);

  const openInvoke = async (target: string) => {
    const root = await findProjectRoot(repo, commit, path);
    const location: string = ctx.extension.location ?? '';
    const base = location.includes('/src/') ? location.slice(0, location.indexOf('/src/')) : '';
    if (!base) {
      setError(`Could not open ${target} — the page address is not a Bitbucket source URL. Open the file from the repository source view.`);
      return;
    }
    await router.navigate(`${base}/src/${commit}/${joinPath(root, target).split('/').map(encodeURIComponent).join('/')}`);
  };

  if (error) return <p className="sbv-error" role="alert">{error}</p>;
  if (!doc) return <p className="sbv-muted" role="status">Reading {path}…</p>;
  return <WorkflowView doc={doc} path={path} onOpenInvoke={openInvoke} />;
}

function ProjectPage({ ctx }: { ctx: FullContext }) {
  const repo: RepoRef = useMemo(() => ({ workspaceId: ctx.workspaceId!, repoUuid: ctx.extension.repository.uuid }), [ctx]);
  const [branches, setBranches] = useState<Branch[]>();
  const [selected, setSelected] = useState<Branch>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    getBranches(repo)
      .then(({ main, branches }) => {
        setBranches(branches);
        setSelected(branches.find((b) => b.name === main) ?? branches[0]);
      })
      .catch((e: Error) => setError(e.message));
  }, [repo]);

  const source = useMemo(() => (selected ? repoSource(repo, selected.hash) : undefined), [repo, selected]);

  if (error) return <p className="sbv-error" role="alert">{error}</p>;
  if (!branches) return <p className="sbv-muted" role="status">Reading branches…</p>;
  if (!source || !selected) return <p className="sbv-muted">This repository has no branches yet. Push a commit and reload the page.</p>;
  return (
    <ProjectOverview
      source={source}
      toolbar={
        <label className="sbv-field">
          <span>Branch</span>
          <select value={selected.name} onChange={(e) => setSelected(branches.find((b) => b.name === e.target.value))}>
            {branches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
        </label>
      }
    />
  );
}

function App() {
  const [ctx, setCtx] = useState<FullContext>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    view.theme.enable().then(syncTheme).catch(() => undefined);
    view.getContext().then(setCtx).catch((e: Error) => setError(`Could not load the app context — ${e.message}. Reload the page.`));
  }, []);

  return (
    <div className="sbv-root">
      {error && <p className="sbv-error" role="alert">{error}</p>}
      {ctx && (ctx.extension.type === 'bitbucket:repoCodeFileViewer' || ctx.extension.file ? <FileViewer ctx={ctx} /> : <ProjectPage ctx={ctx} />)}
      {!ctx && !error && <p className="sbv-muted" role="status">Loading…</p>}
      <AboutFooter version={pkg.version} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
