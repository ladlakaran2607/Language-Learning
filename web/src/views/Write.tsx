import { useState } from "react";
import { Card, ErrorBox, NeedsKey, SpeakButton, Spinner, WordList } from "../components";
import { addLog, addWords, recordErrors } from "../lib/actions";
import { friendlyError, structured } from "../lib/claude";
import { teachingLevel, writingSystem } from "../lib/prompts";
import { WritingFeedbackSchema, WritingPromptSchema, type WritingFeedback, type WritingPrompt } from "../lib/schemas";
import { today } from "../lib/srs";
import { live, uid } from "../lib/state";
import type { JournalEntry } from "../lib/types";
import { useStore } from "../store";

export default function Write() {
  const { state, settings, update } = useStore();
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [busy, setBusy] = useState<"" | "prompt" | "check">("");
  const [error, setError] = useState("");
  const [showJournal, setShowJournal] = useState(false);
  const level = teachingLevel(state.profile.levels.writing);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const opts = { apiKey: settings.apiKey, model: settings.model, system: writingSystem(state) };

  async function newPrompt() {
    setBusy("prompt");
    setError("");
    try {
      const recent = live(state.journal).slice(-5).map((j) => j.prompt).join(" | ");
      setPrompt(
        await structured(WritingPromptSchema, {
          ...opts,
          effort: "low",
          user: `Give me one writing task for level ${level}, realistic and useful (A1: a short message or description; A2: an email or diary entry; B1: a forum post, personal letter or story; B2: an opinion essay, formal complaint or report). Use my interests if given. Avoid repeating: ${recent || "none"}.`,
        }),
      );
      setFeedback(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  }

  async function check() {
    setBusy("check");
    setError("");
    try {
      const fb = await structured(WritingFeedbackSchema, {
        ...opts,
        user: `${prompt ? `Task: ${prompt.prompt_de}\n\n` : ""}Correct my text:\n<text>\n${text.trim()}\n</text>`,
      });
      setFeedback(fb);
      const entry: JournalEntry = {
        id: uid(),
        updatedAt: Date.now(),
        date: today(),
        prompt: prompt?.prompt_de ?? "Free writing",
        original: text.trim(),
        segments: fb.segments,
        corrected: fb.corrected,
        native: fb.native,
        feedback: fb.feedback,
        score: fb.score,
      };
      update((s) => {
        let next = { ...s, journal: [...s.journal, entry] };
        next = addWords(next, fb.new_words).state;
        next = recordErrors(next, fb.errors);
        return addLog(next, "write", `${entry.prompt.slice(0, 60)} (${fb.errors.length} error${fb.errors.length === 1 ? "" : "s"})`, fb.score);
      });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="stack">
      <NeedsKey />
      <h1>Writing</h1>
      <Card
        title="Task"
        actions={
          <button className="link" onClick={newPrompt} disabled={!!busy || !settings.apiKey}>
            {prompt ? "Another task" : "Give me a task"}
          </button>
        }
      >
        {busy === "prompt" ? (
          <Spinner />
        ) : prompt ? (
          <>
            <p className="de-text">{prompt.prompt_de}</p>
            <p className="muted small">
              {prompt.prompt_en} · {prompt.min_words}–{prompt.max_words} words
            </p>
          </>
        ) : (
          <p className="muted">Get a task at your level ({level}), or write anything below: a diary entry about your day is a great daily habit.</p>
        )}
      </Card>

      <Card title="Your text">
        <textarea
          className="writer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Heute habe ich…"
          lang="de"
          spellCheck={false}
        />
        <div className="row spread">
          <span className="muted small">{words} words</span>
          <button className="btn" onClick={check} disabled={!!busy || !text.trim() || !settings.apiKey}>
            {busy === "check" ? "Correcting…" : "Correct my text"}
          </button>
        </div>
        <ErrorBox error={error} onClose={() => setError("")} />
      </Card>

      {busy === "check" && <Spinner label="Marking every error…" />}
      {feedback && <FeedbackView fb={feedback} />}

      <button className="link" onClick={() => setShowJournal(!showJournal)}>
        {showJournal ? "Hide" : "Show"} journal ({live(state.journal).length})
      </button>
      {showJournal &&
        live(state.journal)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((j) => (
            <Card key={j.id} title={`${j.date} · ${j.score}/10`}>
              <p className="muted small">{j.prompt}</p>
              <Marked segments={j.segments} />
              <details>
                <summary>Corrected & native versions</summary>
                <p className="de-text">{j.corrected}</p>
                <p className="de-text native">{j.native}</p>
              </details>
            </Card>
          ))}
    </div>
  );
}

function Marked({ segments }: { segments: WritingFeedback["segments"] }) {
  return (
    <p className="de-text marked">
      {segments.map((s, i) =>
        s.correction && s.correction !== s.text ? (
          <span key={i} className="fix" title={s.explanation ?? ""}>
            <del>{s.text}</del>
            <ins>{s.correction}</ins>
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}

function FeedbackView({ fb }: { fb: WritingFeedback }) {
  return (
    <Card title={`Feedback · ${fb.score}/10`}>
      <p>{fb.feedback}</p>
      <h3>Your text, corrected</h3>
      <Marked segments={fb.segments} />
      {fb.errors.length > 0 && (
        <ul className="plain">
          {fb.errors.map((e, i) => (
            <li key={i}>
              <s>{e.wrong}</s> → <b>{e.right}</b> <span className="muted small">· {e.pattern}</span>
              <div className="small muted">{e.explanation}</div>
            </li>
          ))}
        </ul>
      )}
      <h3>
        Clean version <SpeakButton text={fb.corrected} />
      </h3>
      <p className="de-text">{fb.corrected}</p>
      <h3>
        How a native speaker would write it <SpeakButton text={fb.native} />
      </h3>
      <p className="de-text native">{fb.native}</p>
      {fb.new_words.length > 0 && (
        <>
          <h3>Words worth learning (added to your deck)</h3>
          <WordList words={fb.new_words} />
        </>
      )}
    </Card>
  );
}
