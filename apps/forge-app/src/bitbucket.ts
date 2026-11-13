import { requestBitbucket } from '@forge/bridge';
import type { FileListing, RepoSource } from '@sorenb/xaml-render';

/** Identifies a repository by the ids Forge puts in the extension context. */
export interface RepoRef {
  workspaceId: string;
  repoUuid: string;
}

const enc = encodeURIComponent;
const encodePath = (path: string) => path.split('/').map(enc).join('/');
const repoPath = (r: RepoRef) => `/2.0/repositories/${enc(r.workspaceId)}/${enc(r.repoUuid)}`;

async function get(path: string): Promise<Response> {
  const res = await requestBitbucket(path);
  if (res.ok) return res;
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Could not read from Bitbucket — you do not have access to this repository (HTTP ${res.status}). Ask a workspace admin for read access.`);
  }
  if (res.status === 404) throw new Error(`Could not find ${decodeURIComponent(path.split('/src/')[1] ?? path)} — the file or commit does not exist. Check the branch and path.`);
  throw new Error(`Bitbucket request failed — HTTP ${res.status} ${res.statusText}. Reload the page; if it keeps failing, report it on GitHub.`);
}

export async function readText(r: RepoRef, ref: string, path: string): Promise<string> {
  return (await get(`${repoPath(r)}/src/${enc(ref)}/${encodePath(path)}`)).text();
}

export async function fileExists(r: RepoRef, ref: string, path: string): Promise<boolean> {
  const res = await requestBitbucket(`${repoPath(r)}/src/${enc(ref)}/${encodePath(path)}?format=meta`);
  return res.ok;
}

interface Paged<T> {
  values: T[];
  next?: string;
}

/**
 * Follows Bitbucket pagination up to `limit` pages. `next` links are absolute API URLs, so only their path is passed on.
 * `truncated` is true when Bitbucket had more pages than the limit.
 */
async function getAll<T>(first: string, limit: number): Promise<{ values: T[]; truncated: boolean }> {
  const values: T[] = [];
  let url: string | undefined = first;
  for (let page = 0; url && page < limit; page++) {
    const data = (await (await get(url)).json()) as Paged<T>;
    values.push(...data.values);
    url = data.next ? data.next.replace(/^https:\/\/api\.bitbucket\.org/, '') : undefined;
  }
  return { values, truncated: !!url };
}

/** Most pages of 100 entries read when listing files: 10,000 entries. */
const MAX_LIST_PAGES = 100;

/** Lists every `.xaml` and `project.json` file at a commit, and whether the list was cut off. */
export async function listWorkflowFiles(r: RepoRef, ref: string): Promise<FileListing> {
  const base = `${repoPath(r)}/src/${enc(ref)}/?max_depth=30&pagelen=100`;
  const q = enc('type="commit_file" AND (path ~ ".xaml" OR path ~ "project.json")');
  let listing: { values: { path: string; type: string }[]; truncated: boolean };
  try {
    listing = await getAll(`${base}&q=${q}`, MAX_LIST_PAGES);
  } catch {
    // Some repositories reject the filter; list everything and filter here instead.
    listing = await getAll(base, MAX_LIST_PAGES);
  }
  return {
    paths: listing.values
      .filter((e) => e.type === 'commit_file' && (/\.xaml$/i.test(e.path) || /(^|\/)project\.json$/.test(e.path)))
      .map((e) => e.path),
    truncated: listing.truncated,
  };
}

export interface Branch {
  name: string;
  hash: string;
}

export async function getBranches(r: RepoRef): Promise<{ main?: string; branches: Branch[] }> {
  const [repo, { values: branches }] = await Promise.all([
    get(repoPath(r)).then((res) => res.json() as Promise<{ mainbranch?: { name: string } }>),
    getAll<{ name: string; target: { hash: string } }>(`${repoPath(r)}/refs/branches?pagelen=100&sort=-target.date`, 5),
  ]);
  return { main: repo.mainbranch?.name, branches: branches.map((b) => ({ name: b.name, hash: b.target.hash })) };
}

/** A RepoSource for the project overview, pinned to one commit. */
export function repoSource(r: RepoRef, commit: string): RepoSource {
  return {
    listFiles: () => listWorkflowFiles(r, commit),
    readText: (p) => readText(r, commit, p),
  };
}
