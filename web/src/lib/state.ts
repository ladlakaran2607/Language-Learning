import type { AppState, Profile, Settings, Synced } from "./types";

const STATE_KEY = "deutsch.state.v1";
const SETTINGS_KEY = "deutsch.settings.v1";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best tutor)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (cheaper)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (cheapest, fastest)" },
];

export function defaultProfile(): Profile {
  return {
    placed: false,
    levels: { speaking: "A0", listening: "A0", reading: "A0", writing: "A0", grammar: "A0" },
    nativeLanguage: "English",
    goal: "B2: comfortable conversation, reading and writing",
    interests: "",
    minutesPerDay: 60,
    currentUnit: 1,
    unitsDone: [],
    updatedAt: 0,
  };
}

export function emptyState(): AppState {
  return {
    version: 1,
    profile: defaultProfile(),
    cards: [],
    mistakes: [],
    log: [],
    journal: [],
    conversations: [],
  };
}

export function defaultSettings(): Settings {
  return {
    apiKey: "",
    model: MODELS[0].id,
    githubToken: "",
    gistId: "",
    autoSpeak: true,
    speechRate: 0.9,
    voiceName: "",
    lastSync: 0,
    lastSyncError: "",
  };
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode). The app keeps working in memory.
  }
}

export function normalizeState(raw: Partial<AppState> | null): AppState {
  const base = emptyState();
  if (!raw) return base;
  return {
    version: 1,
    profile: { ...base.profile, ...(raw.profile ?? {}), levels: { ...base.profile.levels, ...(raw.profile?.levels ?? {}) } },
    cards: raw.cards ?? [],
    mistakes: raw.mistakes ?? [],
    log: raw.log ?? [],
    journal: raw.journal ?? [],
    conversations: raw.conversations ?? [],
  };
}

export const loadState = () => normalizeState(read<AppState>(STATE_KEY));
export const saveState = (s: AppState) => write(STATE_KEY, s);
export const loadSettings = (): Settings => ({ ...defaultSettings(), ...(read<Settings>(SETTINGS_KEY) ?? {}) });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Merge two lists of synced records: newest updatedAt wins per id. */
export function mergeById<T extends Synced>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const cur = map.get(item.id);
    if (!cur || item.updatedAt > cur.updatedAt) map.set(item.id, item);
  }
  return [...map.values()];
}

/** Merge the state from two devices without losing work done on either. */
export function mergeStates(a: AppState, b: AppState): AppState {
  return {
    version: 1,
    profile: b.profile.updatedAt > a.profile.updatedAt ? b.profile : a.profile,
    cards: mergeById(a.cards, b.cards),
    mistakes: mergeById(a.mistakes, b.mistakes),
    log: mergeById(a.log, b.log),
    journal: mergeById(a.journal, b.journal),
    conversations: mergeById(a.conversations, b.conversations)
      .sort((x, y) => y.updatedAt - x.updatedAt)
      .slice(0, 30),
  };
}

export const live = <T extends Synced>(items: T[]) => items.filter((i) => !i.deleted);
