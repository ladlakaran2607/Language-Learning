import { useEffect, useRef, useState } from "react";
import { Card, ErrorBox } from "../components";
import { friendlyError, streamReply } from "../lib/claude";
import { germanVoices, speak, ttsSupported } from "../lib/speech";
import { emptyState, MODELS, normalizeState } from "../lib/state";
import { createGist } from "../lib/sync";
import { today } from "../lib/srs";
import { LEVELS, SKILLS, type Level } from "../lib/types";
import { useStore } from "../store";

export default function SettingsView() {
  const { state, settings, setSettings, update, replaceState, sync, syncStatus } = useStore();
  const [key, setKey] = useState(settings.apiKey);
  const [token, setToken] = useState(settings.githubToken);
  const [gist, setGist] = useState(settings.gistId);
  const [test, setTest] = useState("");
  const [error, setError] = useState("");
  const [voices, setVoices] = useState(germanVoices());
  const fileRef = useRef<HTMLInputElement>(null);
  const p = state.profile;

  useEffect(() => {
    if (!ttsSupported()) return;
    const onVoices = () => setVoices(germanVoices());
    speechSynthesis.addEventListener("voiceschanged", onVoices);
    return () => speechSynthesis.removeEventListener("voiceschanged", onVoices);
  }, []);

  const setProfile = (patch: Partial<typeof p>) => update((s) => ({ ...s, profile: { ...s.profile, ...patch, updatedAt: Date.now() } }));

  async function saveKey() {
    setSettings({ apiKey: key.trim() });
    setTest("Testing…");
    setError("");
    try {
      const out = await streamReply({
        apiKey: key.trim(),
        model: settings.model,
        system: "Reply with one short friendly German greeting.",
        messages: [{ role: "user", content: "Hallo!" }],
        onText: () => {},
      });
      setTest(`✅ Works: ${out}`);
    } catch (e) {
      setTest("");
      setError(friendlyError(e));
    }
  }

  async function setupSync() {
    setError("");
    const t = token.trim();
    let id = gist.trim().replace(/^.*\/([0-9a-f]{20,})\/?$/i, "$1");
    try {
      if (!id) id = await createGist(t, state);
      setGist(id);
      setSettings({ githubToken: t, gistId: id });
      // The store re-syncs when token/gist change.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `deutsch-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(file: File) {
    try {
      const data = normalizeState(JSON.parse(await file.text()));
      if (confirm("Replace all progress on this device with the backup?")) replaceState(data);
    } catch {
      setError("That file isn't a valid backup.");
    }
  }

  return (
    <div className="stack">
      <h1>Settings</h1>
      <ErrorBox error={error} onClose={() => setError("")} />

      <Card title="1. Claude API key">
        <p className="small">
          The app talks to Claude directly from your browser using your own key from the{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Claude Console
          </a>
          . It's stored only on this device and is never synced. Set a monthly spend limit in the Console to be safe.
        </p>
        <div className="row">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
          <button className="btn" onClick={saveKey} disabled={!key.trim()}>
            Save & test
          </button>
        </div>
        {test && <p className="ok small">{test}</p>}
        <label>
          Model
          <select value={settings.model} onChange={(e) => setSettings({ model: e.target.value })}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card title="2. Sync phone ↔ laptop (optional)">
        <p className="small">
          Progress is saved in this browser. To share it between devices, the app keeps a copy in a <b>secret GitHub Gist</b> in your account. Create a{" "}
          <a href="https://github.com/settings/tokens/new?scopes=gist&description=Deutsch%20Tutor%20sync" target="_blank" rel="noreferrer">
            GitHub token with only the "gist" scope
          </a>
          , paste it here and press Connect. On your second device, paste the same token <i>and</i> the Gist ID shown below.
        </p>
        <label>
          GitHub token
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" autoComplete="off" />
        </label>
        <label>
          Gist ID (leave empty on your first device to create one)
          <input value={gist} onChange={(e) => setGist(e.target.value)} placeholder="e.g. 8f3c…" autoComplete="off" />
        </label>
        <div className="row">
          <button className="btn" onClick={setupSync} disabled={!token.trim()}>
            Connect
          </button>
          {settings.gistId && (
            <>
              <button className="btn secondary" onClick={() => void sync()} disabled={syncStatus === "syncing"}>
                Sync now
              </button>
              <button
                className="link"
                onClick={() => {
                  setSettings({ githubToken: "", gistId: "" });
                  setToken("");
                  setGist("");
                }}
              >
                Disconnect
              </button>
            </>
          )}
        </div>
        {settings.gistId && (
          <p className="small">
            Gist ID: <code className="selectable">{settings.gistId}</code>
            <br />
            {settings.lastSyncError ? (
              <span className="bad">Last sync failed: {settings.lastSyncError}</span>
            ) : settings.lastSync ? (
              <span className="muted">Last synced {new Date(settings.lastSync).toLocaleString()}</span>
            ) : null}
          </p>
        )}
      </Card>

      <Card title="About you">
        <div className="form-grid">
          <label>
            Explanations in
            <input value={p.nativeLanguage} onChange={(e) => setProfile({ nativeLanguage: e.target.value })} placeholder="English, Hindi…" />
          </label>
          <label>
            Minutes per day
            <input type="number" min={5} max={480} value={p.minutesPerDay} onChange={(e) => setProfile({ minutesPerDay: Number(e.target.value) || 30 })} />
          </label>
          <label className="span2">
            Interests (used for chats and readings)
            <input value={p.interests} onChange={(e) => setProfile({ interests: e.target.value })} placeholder="cricket, tech, cooking, travel…" />
          </label>
          <label className="span2">
            Goal
            <input value={p.goal} onChange={(e) => setProfile({ goal: e.target.value })} />
          </label>
          {SKILLS.map((s) => (
            <label key={s}>
              {s}
              <select value={p.levels[s]} onChange={(e) => setProfile({ levels: { ...p.levels, [s]: e.target.value as Level } })}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="muted small">Levels are set by the placement test; adjust them if they feel off.</p>
      </Card>

      <Card title="Voice">
        {ttsSupported() ? (
          <>
            <label>
              German voice
              <select value={settings.voiceName} onChange={(e) => setSettings({ voiceName: e.target.value })}>
                <option value="">Default</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Speed: {settings.speechRate.toFixed(2)}×
              <input type="range" min={0.6} max={1.2} step={0.05} value={settings.speechRate} onChange={(e) => setSettings({ speechRate: Number(e.target.value) })} />
            </label>
            <label className="toggle">
              <input type="checkbox" checked={settings.autoSpeak} onChange={(e) => setSettings({ autoSpeak: e.target.checked })} /> Read tutor replies aloud automatically
            </label>
            <button className="btn secondary" onClick={() => speak("Hallo! Wie geht es dir heute?", { rate: settings.speechRate, voiceName: settings.voiceName })}>
              Test voice
            </button>
            {!voices.length && <p className="muted small">No German voice found. On phones, add one under system settings → Accessibility → Spoken content / Text-to-speech.</p>}
          </>
        ) : (
          <p className="muted">This browser can't read text aloud.</p>
        )}
      </Card>

      <Card title="Backup">
        <div className="row">
          <button className="btn secondary" onClick={exportBackup}>
            Download backup
          </button>
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>
            Restore backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
          <button
            className="btn danger"
            onClick={() => confirm("Delete ALL progress on this device? (Synced copies are kept until the next sync.)") && replaceState({ ...emptyState(), profile: { ...emptyState().profile, updatedAt: Date.now() } })}
          >
            Reset progress
          </button>
        </div>
      </Card>
    </div>
  );
}
