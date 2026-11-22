import { mergeStates, normalizeState } from "./state";
import type { AppState } from "./types";

// Progress sync between devices through a secret GitHub Gist owned by the learner.
const FILE = "deutsch-progress.json";
const API = "https://api.github.com";

function headers(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  if (res.status === 401) throw new Error("GitHub rejected the token. Create a new one with the 'gist' scope.");
  if (res.status === 404) throw new Error("Sync gist not found. Check the Gist ID, or clear it to create a new one.");
  throw new Error(`GitHub error ${res.status}`);
}

export async function createGist(token: string, state: AppState): Promise<string> {
  const res = await check(
    await fetch(`${API}/gists`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        description: "Deutsch Tutor progress (synced by the app)",
        public: false,
        files: { [FILE]: { content: JSON.stringify(state) } },
      }),
    }),
  );
  return ((await res.json()) as { id: string }).id;
}

export async function pullGist(token: string, gistId: string): Promise<AppState | null> {
  const res = await check(await fetch(`${API}/gists/${gistId}`, { headers: headers(token), cache: "no-store" }));
  const gist = (await res.json()) as { files: Record<string, { content?: string; truncated?: boolean; raw_url?: string }> };
  const file = gist.files[FILE];
  if (!file) return null;
  let content = file.content ?? "";
  if (file.truncated && file.raw_url) content = await (await fetch(file.raw_url)).text();
  return content ? normalizeState(JSON.parse(content)) : null;
}

export async function pushGist(token: string, gistId: string, state: AppState): Promise<void> {
  await check(
    await fetch(`${API}/gists/${gistId}`, {
      method: "PATCH",
      headers: headers(token),
      body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(state) } } }),
    }),
  );
}

/** Pull, merge with local, push the merged result. Returns the merged state. */
export async function syncNow(token: string, gistId: string, local: AppState): Promise<AppState> {
  const remote = await pullGist(token, gistId);
  const merged = remote ? mergeStates(remote, local) : local;
  await pushGist(token, gistId, merged);
  return merged;
}
