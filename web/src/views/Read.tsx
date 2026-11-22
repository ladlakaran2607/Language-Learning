import { Fragment, useState } from "react";
import { Card, ErrorBox, NeedsKey, SpeakButton, Spinner, WordList, wordLabel } from "../components";
import { addLog, addWords, recordErrors } from "../lib/actions";
import { friendlyError, structured } from "../lib/claude";
import { readingSystem, teachingLevel } from "../lib/prompts";
import { LookupSchema, ReadingFeedbackSchema, ReadingSchema, type Lookup, type Reading, type ReadingFeedback } from "../lib/schemas";
import { speak, stopSpeaking } from "../lib/speech";
import { useStore } from "../store";

export default function Read() {
  const { state, settings, update } = useStore();
  const [topic, setTopic] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [discussion, setDiscussion] = useState("");
  const [feedback, setFeedback] = useState<ReadingFeedback | null>(null);
  const [busy, setBusy] = useState<"" | "text" | "check">("");
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState<{ word: string; result: Lookup | null; added?: boolean } | null>(null);
  const [glossaryAdded, setGlossaryAdded] = useState(false);
  const level = teachingLevel(state.profile.levels.reading);
  const opts = { apiKey: settings.apiKey, model: settings.model, system: readingSystem(state) };

  async function generate() {
    setBusy("text");
    setError("");
    stopSpeaking();
    try {
      const r = await structured(ReadingSchema, {
        ...opts,
        user: `Write a new reading text for me at level ${level}${topic.trim() ? ` about: ${topic.trim()}` : ""}.`,
      });
      setReading(r);
      setAnswers(r.questions.map(() => ""));
      setDiscussion("");
      setFeedback(null);
      setGlossaryAdded(false);
      setLookup(null);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  }

  async function checkAnswers() {
    if (!reading) return;
    setBusy("check");
    setError("");
    try {
      const qa = reading.questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i] || "(no answer)"}`).join("\n");
      const fb = await structured(ReadingFeedbackSchema, {
        ...opts,
        user: `Text:\n${reading.text}\n\nMy answers:\n${qa}\n\nDiscussion question: ${reading.discussion}\nMy answer: ${discussion || "(no answer)"}\n\nCheck comprehension (answers[] in question order) and correct the German of my discussion answer.`,
      });
      setFeedback(fb);
      update((s) => addLog(recordErrors(s, fb.errors), "read", `${reading.title} (${level})`, fb.score));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy("");
    }
  }

  async function lookUp(word: string, sentence: string) {
    const clean = word.replace(/[^\p{L}\-]/gu, "");
    if (!clean) return;
    setLookup({ word: clean, result: null });
    try {
      const result = await structured(LookupSchema, {
        ...opts,
        effort: "low",
        user: `Word: "${clean}"\nSentence: "${sentence}"\nGive the dictionary form (lemma), its meaning in ${state.profile.nativeLanguage}, and what it means in this sentence.`,
      });
      setLookup({ word: clean, result });
    } catch (e) {
      setLookup(null);
      setError(friendlyError(e));
    }
  }

  return (
    <div className="stack">
      <NeedsKey />
      <h1>Reading & listening</h1>
      <Card title={`New text · level ${level}`}>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional): football, Berlin, cooking…" />
          <button className="btn" disabled={!!busy || !settings.apiKey}>
            {busy === "text" ? "Writing…" : "Generate"}
          </button>
        </form>
        <ErrorBox error={error} onClose={() => setError("")} />
      </Card>

      {busy === "text" && <Spinner label="Writing a story for you…" />}

      {reading && (
        <>
          <Card
            title={reading.title}
            actions={
              <div className="row">
                <button className="link" onClick={() => speak(reading.text, { rate: settings.speechRate * 0.95, voiceName: settings.voiceName })}>
                  🔊 Read aloud
                </button>
                <button className="link" onClick={() => stopSpeaking()}>
                  ■ Stop
                </button>
              </div>
            }
          >
            <p className="muted small">Tap any word to look it up.</p>
            <ReadingText text={reading.text} glossary={reading.glossary.map((g) => g.de.toLowerCase())} onWord={lookUp} />
            {lookup && (
              <div className="lookup">
                {lookup.result ? (
                  <>
                    <div>
                      <b>{wordLabel(lookup.result)}</b>
                      {lookup.result.plural && <span className="muted">, die {lookup.result.plural}</span>} · {lookup.result.en}{" "}
                      <SpeakButton text={wordLabel(lookup.result)} />
                    </div>
                    <div className="small">Here: {lookup.result.meaning_here}</div>
                    <div className="row">
                      <button
                        className="btn secondary"
                        disabled={lookup.added}
                        onClick={() => {
                          update((s) => addWords(s, [lookup.result!]).state);
                          setLookup({ ...lookup, added: true });
                        }}
                      >
                        {lookup.added ? "Added ✓" : "+ Add to deck"}
                      </button>
                      <button className="link" onClick={() => setLookup(null)}>
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <Spinner label={`Looking up ${lookup.word}…`} />
                )}
              </div>
            )}
          </Card>

          <Card title="Glossary">
            <WordList
              words={reading.glossary}
              onAdd={
                glossaryAdded
                  ? undefined
                  : () => {
                      update((s) => addWords(s, reading.glossary).state);
                      setGlossaryAdded(true);
                    }
              }
              addedNote={glossaryAdded ? "Added to your deck ✓" : undefined}
            />
          </Card>

          <Card title="Fragen">
            <div className="stack-sm">
              {reading.questions.map((q, i) => (
                <label key={i} className="question">
                  <span>
                    {i + 1}. {q}
                  </span>
                  <input
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                    lang="de"
                    spellCheck={false}
                  />
                  {feedback?.answers[i] && (
                    <span className={feedback.answers[i].correct ? "ok small" : "bad small"}>
                      {feedback.answers[i].correct ? "✅ " : "❌ "}
                      {feedback.answers[i].feedback}
                    </span>
                  )}
                </label>
              ))}
              <label className="question">
                <span>💬 {reading.discussion}</span>
                <textarea value={discussion} onChange={(e) => setDiscussion(e.target.value)} rows={3} lang="de" spellCheck={false} />
              </label>
              <button className="btn" onClick={checkAnswers} disabled={!!busy}>
                {busy === "check" ? "Checking…" : "Check my answers"}
              </button>
            </div>
          </Card>

          {feedback && (
            <Card title={`Result · ${feedback.score}/10`}>
              <p>{feedback.discussion_feedback}</p>
              {feedback.discussion_corrected && (
                <>
                  <h3>Your discussion answer, corrected</h3>
                  <p className="de-text">{feedback.discussion_corrected}</p>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ReadingText({ text, glossary, onWord }: { text: string; glossary: string[]; onWord: (w: string, sentence: string) => void }) {
  return (
    <div className="reading">
      {text.split(/\n\s*\n/).map((para, pi) => {
        const sentences = para.match(/[^.!?]+[.!?»“"]*\s*/g) ?? [para];
        return (
          <p key={pi} lang="de">
            {sentences.map((sentence, si) => (
              <Fragment key={si}>
                {sentence.split(/(\s+)/).map((tok, ti) => {
                  if (!tok.trim()) return tok;
                  const bare = tok.replace(/[^\p{L}\-]/gu, "").toLowerCase();
                  return (
                    <span key={ti} className={`w ${glossary.includes(bare) ? "gl" : ""}`} onClick={() => onWord(tok, sentence.trim())}>
                      {tok}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
