import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { loadSettings, loadState, mergeStates, saveSettings, saveState } from "./lib/state";
import { syncNow } from "./lib/sync";
import type { AppState, Settings } from "./lib/types";

type SyncStatus = "off" | "idle" | "syncing" | "ok" | "error";

interface Store {
  state: AppState;
  settings: Settings;
  update: (fn: (s: AppState) => AppState) => void;
  setSettings: (patch: Partial<Settings>) => void;
  replaceState: (s: AppState) => void;
  sync: () => Promise<void>;
  syncStatus: SyncStatus;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  const timer = useRef<number | undefined>(undefined);
  const syncing = useRef(false);
  stateRef.current = state;
  settingsRef.current = settings;

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const sync = useCallback(async () => {
    const { githubToken, gistId } = settingsRef.current;
    if (!githubToken || !gistId || syncing.current) return;
    syncing.current = true;
    setSyncStatus("syncing");
    try {
      const merged = await syncNow(githubToken, gistId, stateRef.current);
      setState((prev) => {
        const next = mergeStates(prev, merged);
        saveState(next);
        return next;
      });
      setSyncStatus("ok");
      setSettings({ lastSync: Date.now(), lastSyncError: "" });
    } catch (e) {
      setSyncStatus("error");
      setSettings({ lastSyncError: e instanceof Error ? e.message : String(e) });
    } finally {
      syncing.current = false;
    }
  }, [setSettings]);

  const scheduleSync = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void sync(), 3000);
  }, [sync]);

  const update = useCallback(
    (fn: (s: AppState) => AppState) => {
      setState((prev) => {
        const next = fn(prev);
        saveState(next);
        return next;
      });
      scheduleSync();
    },
    [scheduleSync],
  );

  const replaceState = useCallback(
    (s: AppState) => {
      saveState(s);
      setState(s);
      scheduleSync();
    },
    [scheduleSync],
  );

  // Pull on start and whenever the app comes back to the foreground (e.g. switching phone ↔ laptop).
  useEffect(() => {
    setSyncStatus(settings.githubToken && settings.gistId ? "idle" : "off");
    void sync();
    const onVisible = () => document.visibilityState === "visible" && void sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [settings.githubToken, settings.gistId, sync]);

  return (
    <Ctx.Provider value={{ state, settings, update, setSettings, replaceState, sync, syncStatus }}>{children}</Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
