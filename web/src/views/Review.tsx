import { useMemo, useRef, useState } from "react";
import { Card, ErrorBox, SpeakButton, wordLabel } from "../components";
import { addLog, addWords } from "../lib/actions";
import { friendlyError, structured } from "../lib/claude";
import { WordSchema } from "../lib/schemas";
import { checkEnglish, checkGerman, dueCards, schedule, today, type CheckResult, type Grade } from "../lib/srs";
import { live } from "../lib/state";
import { cardsToTsv, tsvToCards } from "../lib/tsv";
import { WORD_TYPES, type Card as VocabCard, type WordType } from "../lib/types";
import { useStore } from "../store";

const SESSION_SIZE = 20;

export default function Review() {
  const [tab, setTab] = useState<"review" | "deck">("review");
  return (
    <div className="stack">
      <div className="tabs">
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>
          Review
        </button>
        <button className={tab === "deck" ? "active" : ""} onClick={() => setTab("deck")}>
          My deck
        </button>
      </div>
      {tab === "review" ? <ReviewSession /> : <Deck />}
    </div>
  );
}

function ReviewSession() {
  const { state, update } = useStore();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [answer, setAnswer] = useState("");
  const [plural, setPlural] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [tally, setTally] = useState({ correct: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const due = dueCards(state.cards);

  if (!queue) {
    return (
      <Card title="Spaced repetition">
        {due.length ? (
          <>
            <p>
              <b>{due.length}</b> word{due.length === 1 ? "" : "s"} due. A session reviews up to {SESSION_SIZE}, alternating English → German (with article and plural)
              and German → English.
            </p>
            <button
              className="btn"
              onClick={() => {
                setQueue(due.slice(0, SESSION_SIZE).map((c) => c.id));
                setPos(0);
                setTally({ correct: 0, total: 0 });
              }}
            >
              Start review
            </button>
          </>
        ) : (
          <p className="muted">
            Nothing due right now. {live(state.cards).length ? "Come back tomorrow, or learn new words in a lesson, chat or reading." : "Your deck is empty: finish a lesson, chat or reading and new words land here automatically, or add some under My deck."}
          </p>
        )}
        <BoxChart cards={live(state.cards)} />
      </Card>
    );
  }

  if (pos >= queue.length) {
    return (
      <Card title="Session done 🎉">
        <p>
          {tally.correct} of {tally.total} correct. {dueCards(state.cards).length} still due today.
        </p>
        <button className="btn" onClick={() => setQueue(null)}>
          Back
        </button>
      </Card>
    );
  }

  const card = state.cards.find((c) => c.id === queue[pos]);
  if (!card) {
    setPos(pos + 1);
    return null;
  }
  const toGerman = pos % 2 === 0;
  const askPlural = toGerman && card.type === "noun" && !!card.plural;

  function check() {
    if (!card) return;
    setResult(toGerman ? checkGerman(card, answer, askPlural ? plural : undefined) : checkEnglish(card, answer));
  }

  function grade(g: Grade) {
    if (!card) return;
    update((s) => {
      let next = { ...s, cards: s.cards.map((c) => (c.id === card.id ? schedule(c, g) : c)) };
      if (pos === queue!.length - 1) next = addLog(next, "review", `Reviewed ${tally.total + 1} words`, ((tally.correct + (g === "correct" ? 1 : 0)) / (tally.total + 1)) * 10);
      return next;
    });
    setTally((t) => ({ correct: t.correct + (g === "correct" ? 1 : 0), total: t.total + 1 }));
    setAnswer("");
    setPlural("");
    setResult(null);
    setPos(pos + 1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <Card
      title={`${pos + 1} / ${queue.length}`}
      actions={
        <button className="link" onClick={() => setQueue(null)}>
          End
        </button>
      }
    >
      <div className="flash">
        <div className="flash-dir">{toGerman ? "Say it in German" : "What does it mean?"}</div>
        <div className="flash-prompt">
          {toGerman ? card.en : wordLabel(card)}
          {!toGerman && <SpeakButton text={wordLabel(card)} />}
        </div>
        {toGerman && card.type === "noun" && <div className="muted small">noun: include der/die/das</div>}
        <form
          className="stack-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!result) check();
          }}
        >
          <input
            ref={inputRef}
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={toGerman ? (card.type === "noun" ? "der/die/das …" : "Deutsch…") : "English…"}
            disabled={!!result}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            lang={toGerman ? "de" : "en"}
          />
          {askPlural && (
            <input value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="Plural: die …" disabled={!!result} autoCapitalize="off" autoCorrect="off" spellCheck={false} lang="de" />
          )}
          {!result && (
            <div className="row">
              <button className="btn">Check</button>
              <button type="button" className="btn secondary" onClick={() => setResult({ grade: "wrong", notes: ["Here's the answer."] })}>
                Show answer
              </button>
            </div>
          )}
        </form>

        {result && (
          <div className={`verdict ${result.grade}`}>
            <b>{result.grade === "correct" ? "Richtig! ✅" : result.grade === "partial" ? "Fast! 🟡" : "Nicht ganz ❌"}</b>
            {result.notes.map((n, i) => (
              <div key={i}>{n}</div>
            ))}
            <div className="answer">
              <b>{wordLabel(card)}</b>
              {card.plural && <span className="muted">, die {card.plural}</span>} · {card.en} <SpeakButton text={wordLabel(card)} />
            </div>
            {card.example && <div className="small">„{card.example}“</div>}
            <div className="row">
              <button className="btn" autoFocus onClick={() => grade(result.grade)}>
                Next
              </button>
              {result.grade !== "correct" && (
                <button className="btn secondary" onClick={() => grade("correct")}>
                  I was right
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function BoxChart({ cards }: { cards: VocabCard[] }) {
  if (!cards.length) return null;
  const counts = [1, 2, 3, 4, 5].map((b) => cards.filter((c) => c.box === b).length);
  const max = Math.max(...counts, 1);
  const labels = ["new", "3 d", "1 wk", "2 wk", "5 wk"];
  return (
    <div className="boxes" aria-label="Words per box">
      {counts.map((n, i) => (
        <div key={i} className="box-col">
          <div className="box-bar" style={{ height: `${(n / max) * 60 + 4}px` }} />
          <b>{n}</b>
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Deck() {
  const { state, settings, update } = useStore();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({ de: "", en: "", type: "noun" as WordType, article: "", plural: "", example: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const cards = useMemo(() => {
    const term = q.trim().toLowerCase();
    return live(state.cards)
      .filter((c) => !term || c.de.toLowerCase().includes(term) || c.en.toLowerCase().includes(term))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.cards, q]);

  async function autofill() {
    if (!draft.de.trim()) return;
    setBusy(true);
    setError("");
    try {
      const w = await structured(WordSchema, {
        apiKey: settings.apiKey,
        model: settings.model,
        system: `You are a German dictionary for a learner whose native language is ${state.profile.nativeLanguage}. Give the base form (lemma).`,
        user: `Word or phrase: ${draft.de.trim()}`,
        effort: "low",
      });
      setDraft({ ...w });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!draft.de.trim() || !draft.en.trim()) return;
    const { added } = addWords(state, [draft]);
    update((s) => addWords(s, [draft]).state);
    setNote(added ? `Added ${draft.de}.` : `${draft.de} is already in your deck.`);
    setDraft({ de: "", en: "", type: "noun", article: "", plural: "", example: "" });
  }

  function remove(c: VocabCard) {
    update((s) => ({ ...s, cards: s.cards.map((x) => (x.id === c.id ? { ...x, deleted: true, updatedAt: Date.now() } : x)) }));
  }

  function exportTsv() {
    const blob = new Blob([cardsToTsv(state.cards)], { type: "text/tab-separated-values" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vocab-${today()}.tsv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importTsv(file: File) {
    const incoming = tsvToCards(await file.text());
    const { added } = addWords(state, incoming);
    update((s) => addWords(s, incoming).state);
    setNote(`Imported ${added} new words.`);
  }

  return (
    <>
      <Card title="Add a word">
        <div className="form-grid">
          <label>
            German
            <input value={draft.de} onChange={(e) => setDraft({ ...draft, de: e.target.value })} placeholder="e.g. Schlüssel" lang="de" />
          </label>
          <label>
            Meaning
            <input value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} placeholder="e.g. key" />
          </label>
          <label>
            Type
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as WordType })}>
              {WORD_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          {draft.type === "noun" && (
            <>
              <label>
                Article
                <select value={draft.article} onChange={(e) => setDraft({ ...draft, article: e.target.value })}>
                  <option value="">–</option>
                  <option>der</option>
                  <option>die</option>
                  <option>das</option>
                </select>
              </label>
              <label>
                Plural
                <input value={draft.plural} onChange={(e) => setDraft({ ...draft, plural: e.target.value })} placeholder="Schlüssel" lang="de" />
              </label>
            </>
          )}
          <label className="span2">
            Example
            <input value={draft.example} onChange={(e) => setDraft({ ...draft, example: e.target.value })} placeholder="Wo ist mein Schlüssel?" lang="de" />
          </label>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={autofill} disabled={busy || !draft.de.trim() || !settings.apiKey}>
            {busy ? "Looking up…" : "✨ Fill in with AI"}
          </button>
          <button className="btn" onClick={add} disabled={!draft.de.trim() || !draft.en.trim()}>
            Add
          </button>
        </div>
        <ErrorBox error={error} onClose={() => setError("")} />
        {note && <p className="ok">{note}</p>}
      </Card>

      <Card
        title={`My deck (${live(state.cards).length})`}
        actions={
          <div className="row">
            <button className="link" onClick={exportTsv}>
              Export TSV
            </button>
            <button className="link" onClick={() => fileRef.current?.click()}>
              Import TSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".tsv,.txt,text/tab-separated-values,text/plain"
              hidden
              onChange={(e) => e.target.files?.[0] && importTsv(e.target.files[0])}
            />
          </div>
        }
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" />
        <ul className="wordlist">
          {cards.map((c) => (
            <li key={c.id}>
              <span className="de">
                {wordLabel(c)}
                {c.plural && <span className="muted">, die {c.plural}</span>}
              </span>
              <span className="en">{c.en}</span>
              <span className="muted small" title="Leitner box, next review">
                box {c.box} · {c.due <= today() ? "due" : c.due}
              </span>
              <SpeakButton text={wordLabel(c)} />
              <button className="icon-btn" aria-label={`Delete ${c.de}`} onClick={() => remove(c)}>
                🗑
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">Export works with Anki (tab-separated) and matches german/vocab.tsv used by the Claude Code skill.</p>
      </Card>
    </>
  );
}
