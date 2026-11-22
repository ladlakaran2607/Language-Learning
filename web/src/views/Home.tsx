import { go } from "../App";
import { Card } from "../components";
import { CURRICULUM, unitByNumber } from "../lib/curriculum";
import { overallLevel } from "../lib/prompts";
import { dueCards, streak, today } from "../lib/srs";
import { live } from "../lib/state";
import { MISTAKE_LABELS, SKILLS } from "../lib/types";
import { useStore } from "../store";

export default function Home() {
  const { state, settings } = useStore();
  const p = state.profile;
  const due = dueCards(state.cards).length;
  const unit = unitByNumber(p.currentUnit);
  const cards = live(state.cards);
  const days = streak(state.log);
  const todayCount = state.log.filter((l) => !l.deleted && l.date === today()).length;
  const mistakes = live(state.mistakes).sort((a, b) => b.count - a.count).slice(0, 3);
  const recent = live(state.log).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const b2Index = CURRICULUM.findIndex((u) => u.level === "B2");
  const total = CURRICULUM.length;
  const done = p.unitsDone.length;

  return (
    <div className="stack">
      {!settings.apiKey && (
        <Card title="Willkommen! 👋">
          <p>Three steps to get started:</p>
          <ol>
            <li>
              <a href="#/settings">Add your Anthropic API key</a> in Settings (it stays on this device).
            </li>
            <li>Take the 10-minute placement test so lessons match your level.</li>
            <li>Optional: turn on sync in Settings to use the app on both phone and laptop.</li>
          </ol>
        </Card>
      )}

      {!p.placed && (
        <Card title="Find your level">
          <p>A short adaptive test (about 12 questions) sets your level per skill and your starting unit.</p>
          <button className="btn" onClick={() => go("chat", "placement")}>
            Start placement test
          </button>
        </Card>
      )}

      <div className="stats">
        <div className="stat">
          <b>{days}</b>
          <span>day streak{todayCount ? " ✓" : ""}</span>
        </div>
        <div className="stat">
          <b>{overallLevel(state)}</b>
          <span>level</span>
        </div>
        <div className="stat">
          <b>{cards.length}</b>
          <span>words</span>
        </div>
        <div className="stat">
          <b>
            {done}/{total}
          </b>
          <span>units</span>
        </div>
      </div>

      <Card title="Today">
        <div className="today-list">
          <button className="today-item" onClick={() => go("review")}>
            <span className="ti-icon">🃏</span>
            <span>
              <b>Review words</b>
              <small>{due ? `${due} due now` : "Nothing due. Add words from lessons and chats."}</small>
            </span>
          </button>
          <button className="today-item" onClick={() => go("chat", `lesson:${p.currentUnit}`)}>
            <span className="ti-icon">📘</span>
            <span>
              <b>Next lesson</b>
              <small>{unit ? `Unit ${unit.n} (${unit.level}): ${unit.title}` : "All units done 🎉"}</small>
            </span>
          </button>
          <button className="today-item" onClick={() => go("chat")}>
            <span className="ti-icon">🗣️</span>
            <span>
              <b>Speak or chat</b>
              <small>Role-play with voice, corrections included</small>
            </span>
          </button>
          <button className="today-item" onClick={() => go("write")}>
            <span className="ti-icon">✍️</span>
            <span>
              <b>Write 5–10 sentences</b>
              <small>Get every error marked and a native version</small>
            </span>
          </button>
          <button className="today-item" onClick={() => go("read")}>
            <span className="ti-icon">📖</span>
            <span>
              <b>Read & listen</b>
              <small>A story at your level, read aloud</small>
            </span>
          </button>
        </div>
      </Card>

      <div className="grid2">
        <Card title="Levels">
          <table className="levels">
            <tbody>
              {SKILLS.map((s) => (
                <tr key={s}>
                  <td>{s}</td>
                  <td>
                    <b>{p.levels[s]}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            {b2Index >= 0 && p.currentUnit < CURRICULUM[b2Index].n
              ? `${CURRICULUM.filter((u) => u.level !== "B2" && !p.unitsDone.includes(u.n)).length} units to go before B2 material.`
              : "You're in B2 territory."}
          </p>
        </Card>

        <Card title="Watch out for">
          {mistakes.length ? (
            <ul className="plain">
              {mistakes.map((m) => (
                <li key={m.id}>
                  <b>{m.pattern}</b> <span className="muted">×{m.count} · {MISTAKE_LABELS[m.type]}</span>
                  <div className="small">
                    <s>{m.wrong}</s> → {m.right}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Your recurring mistakes will show up here, and the tutor will keep drilling them.</p>
          )}
        </Card>
      </div>

      {recent.length > 0 && (
        <Card title="Recent sessions">
          <ul className="plain">
            {recent.map((l) => (
              <li key={l.id}>
                <span className="muted small">{l.date} · {l.mode}</span>
                {l.score !== undefined && <span className="pill">{Math.round(l.score)}/10</span>}
                <div className="small">{l.summary}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
