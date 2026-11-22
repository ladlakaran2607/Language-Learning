import { go } from "../App";
import { Card } from "../components";
import { CURRICULUM } from "../lib/curriculum";
import { live } from "../lib/state";
import { useStore } from "../store";

const LEVEL_INFO: Record<string, string> = {
  A1: "Survival: introduce yourself, shop, ask simple questions",
  A2: "Everyday independence: offices, doctors, your past",
  B1: "Comfortable conversation on familiar topics",
  B2: "Fluency and range: opinions, news, formal writing",
};

export default function Lessons() {
  const { state } = useStore();
  const p = state.profile;
  const levels = [...new Set(CURRICULUM.map((u) => u.level))];
  const inProgress = new Map(
    live(state.conversations)
      .filter((c) => c.mode === "lesson" && !c.finished && c.unit)
      .map((c) => [c.unit!, c.id]),
  );

  return (
    <div className="stack">
      <h1>Lessons A1 → B2</h1>
      <p className="muted">
        {p.unitsDone.length} of {CURRICULUM.length} units done. Each lesson: examples, the rule, 8–10 drills with corrections and a mini dialogue. Score 80% or more to
        pass. You can open any unit.
      </p>
      <button className="btn" onClick={() => go("chat", `lesson:${p.currentUnit}`)}>
        Continue with unit {p.currentUnit}
      </button>
      {levels.map((level) => {
        const units = CURRICULUM.filter((u) => u.level === level);
        const done = units.filter((u) => p.unitsDone.includes(u.n)).length;
        return (
          <Card key={level} title={`${level} · ${done}/${units.length}`}>
            <p className="muted small">{LEVEL_INFO[level]}</p>
            <div className="progress">
              <div style={{ width: `${(done / units.length) * 100}%` }} />
            </div>
            <ol className="units">
              {units.map((u) => {
                const isDone = p.unitsDone.includes(u.n);
                const isCurrent = u.n === p.currentUnit;
                const open = inProgress.get(u.n);
                return (
                  <li key={u.n} className={`${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}>
                    <button
                      className="unit-btn"
                      onClick={() => (open ? go("chat", `c:${open}`) : go("chat", `lesson:${u.n}`))}
                    >
                      <span className="unit-n">{isDone ? "✓" : u.n}</span>
                      <span>
                        <b>{u.title}</b>
                        {u.theme && <small> · {u.theme}</small>}
                        {open && <small className="pill">in progress</small>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>
        );
      })}
    </div>
  );
}
