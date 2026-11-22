import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo, type ReactNode } from "react";
import type { Word } from "./lib/schemas";
import { speak } from "./lib/speech";
import { useStore } from "./store";

marked.setOptions({ gfm: true, breaks: true });

export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false }) as string), [text]);
  return <div className={`md ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Card({ title, children, actions }: { title?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorBox({ error, onClose }: { error: string; onClose?: () => void }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <span>{error}</span>
      {onClose && (
        <button className="link" onClick={onClose} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}

export function SpeakButton({ text, label = "🔊" }: { text: string; label?: string }) {
  const { settings } = useStore();
  return (
    <button
      type="button"
      className="icon-btn"
      title="Listen"
      aria-label="Listen"
      onClick={() => speak(text, { rate: settings.speechRate, voiceName: settings.voiceName })}
    >
      {label}
    </button>
  );
}

export function NeedsKey() {
  const { settings } = useStore();
  if (settings.apiKey) return null;
  return (
    <div className="banner">
      This needs your Anthropic API key. <a href="#/settings">Add it in Settings</a> (it stays on this device).
    </div>
  );
}

export function Spinner({ label = "Thinking…" }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
      <span className="sr">{label}</span>
      <span className="spinner-label">{label}</span>
    </div>
  );
}

export function wordLabel(w: Pick<Word, "de" | "article" | "type">) {
  return w.type === "noun" && w.article ? `${w.article} ${w.de}` : w.de;
}

export function WordList({ words, onAdd, addedNote }: { words: Word[]; onAdd?: () => void; addedNote?: string }) {
  if (!words.length) return null;
  return (
    <div>
      <ul className="wordlist">
        {words.map((w, i) => (
          <li key={i}>
            <span className="de">
              {wordLabel(w)}
              {w.plural ? <span className="muted">, die {w.plural}</span> : null}
            </span>
            <span className="en">{w.en}</span>
            <SpeakButton text={wordLabel(w)} />
          </li>
        ))}
      </ul>
      {onAdd && (
        <button className="btn secondary" onClick={onAdd}>
          + Add {words.length} words to my deck
        </button>
      )}
      {addedNote && <p className="ok">{addedNote}</p>}
    </div>
  );
}
