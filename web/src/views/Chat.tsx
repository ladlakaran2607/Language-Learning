import { useEffect, useRef, useState } from "react";
import { go } from "../App";
import { Card, ErrorBox, Markdown, NeedsKey, Spinner, WordList } from "../components";
import { addLog, addWords, recordErrors } from "../lib/actions";
import { friendlyError, streamReply, structured } from "../lib/claude";
import { CURRICULUM, unitByNumber } from "../lib/curriculum";
import {
  CHAT_TOPICS,
  chatSystem,
  debriefInstruction,
  kickoff,
  lessonSystem,
  overallLevel,
  placementSystem,
  teachingLevel,
} from "../lib/prompts";
import { DebriefSchema, LessonResultSchema, PlacementSchema, type Debrief, type LessonResult, type Placement } from "../lib/schemas";
import { listen, speak, stopSpeaking, sttSupported } from "../lib/speech";
import { live, uid } from "../lib/state";
import type { AppState, ChatMode, Conversation } from "../lib/types";
import { useStore } from "../store";

function newConversation(state: AppState, spec: string): Conversation | null {
  const now = Date.now();
  const base = { id: uid(), updatedAt: now, startedAt: now, finished: false };
  if (spec === "placement") {
    return { ...base, mode: "placement", title: "Placement test", system: placementSystem(state), messages: [{ role: "user", content: kickoff.placement, hidden: true }] };
  }
  if (spec.startsWith("lesson:")) {
    const unit = unitByNumber(Number(spec.slice(7)));
    if (!unit) return null;
    return {
      ...base,
      mode: "lesson",
      unit: unit.n,
      title: `Unit ${unit.n}: ${unit.title}`,
      system: lessonSystem(state, unit),
      messages: [{ role: "user", content: kickoff.lesson, hidden: true }],
    };
  }
  if (spec.startsWith("topic:")) {
    const topic = spec.slice(6).trim();
    if (!topic) return null;
    return { ...base, mode: "chat", title: topic, system: chatSystem(state, topic), messages: [{ role: "user", content: kickoff.chat, hidden: true }] };
  }
  return null;
}

export default function Chat({ param }: { param: string }) {
  const { state, update } = useStore();

  // A "new session" link (placement / lesson:N / topic:X) creates a conversation, then opens it.
  useEffect(() => {
    if (!param || param.startsWith("c:")) return;
    const conv = newConversation(state, param);
    if (!conv) return go("chat");
    update((s) => ({ ...s, conversations: [conv, ...s.conversations] }));
    window.location.replace(`#/chat/${encodeURIComponent("c:" + conv.id)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  if (param.startsWith("c:")) {
    const conv = state.conversations.find((c) => c.id === param.slice(2));
    if (conv) return <ConversationView key={conv.id} conv={conv} />;
  }
  if (param) return <Spinner label="Starting…" />;
  return <StartScreen />;
}

function StartScreen() {
  const { state } = useStore();
  const [custom, setCustom] = useState("");
  const level = teachingLevel(overallLevel(state));
  const open = live(state.conversations)
    .filter((c) => !c.finished && c.messages.some((m) => m.role === "assistant"))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  return (
    <div className="stack">
      <NeedsKey />
      <h1>Conversation practice</h1>
      <p className="muted">
        Pick a situation. The tutor replies in German at your level ({level}) and corrects you as you go. Tap 🎙️ to
        speak, or turn on hands-free voice mode.
      </p>

      {open.length > 0 && (
        <Card title="Continue">
          <ul className="plain">
            {open.map((c) => (
              <li key={c.id}>
                <a href={`#/chat/${encodeURIComponent("c:" + c.id)}`}>{c.title}</a>{" "}
                <span className="muted small">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Your own topic">
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) go("chat", `topic:${custom.trim()}`);
          }}
        >
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Talking about cricket, ordering at a bakery…" />
          <button className="btn" disabled={!custom.trim()}>
            Start
          </button>
        </form>
      </Card>

      {CHAT_TOPICS.map((group) => (
        <Card key={group.level} title={`${group.level}${group.level === level ? " · your level" : ""}`}>
          <div className="chips">
            {group.topics.map((t) => (
              <button key={t} className={`chip ${group.level === level ? "chip-hi" : ""}`} onClick={() => go("chat", `topic:${t}`)}>
                {t}
              </button>
            ))}
          </div>
        </Card>
      ))}

      <Card title="Other sessions">
        <div className="chips">
          <button className="chip" onClick={() => go("chat", "placement")}>
            {state.profile.placed ? "Retake placement test" : "Placement test"}
          </button>
          <button className="chip" onClick={() => go("chat", `lesson:${state.profile.currentUnit}`)}>
            Next lesson (unit {state.profile.currentUnit})
          </button>
        </div>
      </Card>
    </div>
  );
}

function TutorMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  const corrections = lines.filter((l) => l.trim().startsWith("✏️"));
  const rest = lines.filter((l) => !l.trim().startsWith("✏️")).join("\n").trim();
  return (
    <>
      {corrections.map((c, i) => (
        <div key={i} className="correction">
          {c.trim()}
        </div>
      ))}
      {rest && <Markdown text={rest} />}
    </>
  );
}

function ConversationView({ conv }: { conv: Conversation }) {
  const { state, settings, setSettings, update } = useStore();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const stopListening = useRef<() => void>(() => {});
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  const visible = conv.messages.map((m, i) => ({ ...m, i })).filter((m) => !m.hidden);
  const last = conv.messages[conv.messages.length - 1];
  const awaitingReply = last?.role === "user";

  const saveConv = (patch: Partial<Conversation>) =>
    update((s) => ({
      ...s,
      conversations: s.conversations.map((c) => (c.id === conv.id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    }));

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv.messages.length, streaming]);

  // Fetch the tutor's turn whenever the conversation ends on a learner message.
  useEffect(() => {
    if (awaitingReply && streaming === null && !error && !conv.finished && settings.apiKey) void reply(conv.messages);
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.messages.length]);

  async function reply(messages: Conversation["messages"]) {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setStreaming("");
    setError("");
    try {
      const text = await streamReply({
        apiKey: settings.apiKey,
        model: settings.model,
        system: conv.system,
        effort: conv.mode === "chat" ? "low" : "medium",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        onText: setStreaming,
        signal: ctl.signal,
      });
      saveConv({ messages: [...messages, { role: "assistant", content: text }] });
      if (settings.autoSpeak || handsFreeRef.current) {
        speak(text, {
          rate: settings.speechRate,
          voiceName: settings.voiceName,
          onEnd: () => handsFreeRef.current && startListening(true),
        });
      }
    } catch (e) {
      if (!ctl.signal.aborted) setError(friendlyError(e));
    } finally {
      if (abort.current === ctl) setStreaming(null);
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || streaming !== null) return;
    stopSpeaking();
    setInput("");
    saveConv({ messages: [...conv.messages, { role: "user", content: t }] });
  }

  function startListening(autoSend: boolean) {
    stopSpeaking();
    setListening(true);
    stopListening.current = listen({
      onText: setInput,
      onDone: (t) => {
        setListening(false);
        if (autoSend && handsFreeRef.current && t) send(t);
        else if (t) setInput(t);
      },
      onError: (msg) => {
        setListening(false);
        setError(msg);
      },
    });
  }

  async function translate(i: number, text: string) {
    setTranslations((t) => ({ ...t, [i]: "…" }));
    try {
      const out = await streamReply({
        apiKey: settings.apiKey,
        model: settings.model,
        system: `Translate the German text into ${state.profile.nativeLanguage}. Output only the translation. Skip lines that start with ✏️.`,
        messages: [{ role: "user", content: text }],
        onText: (t) => setTranslations((x) => ({ ...x, [i]: t })),
      });
      setTranslations((x) => ({ ...x, [i]: out }));
    } catch (e) {
      setTranslations((x) => ({ ...x, [i]: friendlyError(e) }));
    }
  }

  async function finish() {
    stopSpeaking();
    setFinishing(true);
    setError("");
    const transcript = conv.messages
      .filter((m) => !m.hidden)
      .map((m) => `${m.role === "user" ? "LEARNER" : "TUTOR"}: ${m.content}`)
      .join("\n\n");
    const user = `${debriefInstruction(conv.mode)}\n\n<transcript>\n${transcript}\n</transcript>`;
    const opts = { apiKey: settings.apiKey, model: settings.model, system: conv.system, user, effort: "medium" as const };
    try {
      if (conv.mode === "placement") {
        const r = await structured(PlacementSchema, opts);
        const startUnit = CURRICULUM.some((u) => u.n === r.start_unit) ? r.start_unit : 1;
        update((s) => {
          const done = CURRICULUM.filter((u) => u.n < startUnit).map((u) => u.n);
          let next: AppState = {
            ...s,
            profile: { ...s.profile, placed: true, levels: r.levels, currentUnit: startUnit, unitsDone: [...new Set([...s.profile.unitsDone, ...done])], updatedAt: Date.now() },
          };
          next = addLog(next, "placement", r.summary);
          return finishConv(next, conv.id, r);
        });
      } else if (conv.mode === "lesson") {
        const r = await structured(LessonResultSchema, opts);
        update((s) => {
          let next = applyDebrief(s, r, conv.mode, conv.title);
          if (r.passed && conv.unit) {
            const unitsDone = [...new Set([...next.profile.unitsDone, conv.unit])];
            const nextUnit = CURRICULUM.find((u) => !unitsDone.includes(u.n))?.n ?? conv.unit;
            next = { ...next, profile: { ...next.profile, unitsDone, currentUnit: nextUnit, updatedAt: Date.now() } };
          }
          return finishConv(next, conv.id, r);
        });
      } else {
        const r = await structured(DebriefSchema, opts);
        update((s) => finishConv(applyDebrief(s, r, conv.mode, conv.title), conv.id, r));
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setFinishing(false);
    }
  }

  const learnerTurns = conv.messages.filter((m) => m.role === "user" && !m.hidden).length;

  return (
    <div className="chat">
      <div className="chat-head">
        <button className="link" onClick={() => go("chat")}>
          ← All
        </button>
        <h1 className="chat-title">{conv.title}</h1>
        <label className="toggle" title="Read tutor replies aloud">
          <input type="checkbox" checked={settings.autoSpeak} onChange={(e) => setSettings({ autoSpeak: e.target.checked })} /> 🔊
        </label>
      </div>
      <NeedsKey />

      <div className="messages">
        {visible.map((m) => (
          <div key={m.i} className={`msg ${m.role}`}>
            {m.role === "assistant" ? <TutorMessage text={m.content} /> : <p>{m.content}</p>}
            {m.role === "assistant" && (
              <div className="msg-tools">
                <button className="link" onClick={() => speak(m.content, { rate: settings.speechRate, voiceName: settings.voiceName })}>
                  🔊 Listen
                </button>
                <button className="link" onClick={() => translate(m.i, m.content)}>
                  🌐 Translate
                </button>
              </div>
            )}
            {translations[m.i] && <div className="translation">{translations[m.i]}</div>}
          </div>
        ))}
        {streaming !== null && (
          <div className="msg assistant">{streaming ? <TutorMessage text={streaming} /> : <Spinner />}</div>
        )}
        <div ref={bottom} />
      </div>

      <ErrorBox error={error} onClose={() => setError("")} />
      {error && awaitingReply && streaming === null && (
        <button className="btn secondary" onClick={() => reply(conv.messages)}>
          Retry
        </button>
      )}

      {conv.finished ? (
        <DebriefView conv={conv} />
      ) : (
        <>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Listening… sprich jetzt" : "Schreib auf Deutsch…"}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <div className="composer-btns">
              {sttSupported() && (
                <button
                  type="button"
                  className={`icon-btn big ${listening ? "rec" : ""}`}
                  aria-label={listening ? "Stop listening" : "Speak"}
                  onClick={() => (listening ? stopListening.current() : startListening(false))}
                >
                  🎙️
                </button>
              )}
              <button className="btn" disabled={!input.trim() || streaming !== null}>
                Send
              </button>
            </div>
          </form>
          <div className="chat-actions">
            {sttSupported() && (
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={handsFree}
                  onChange={(e) => {
                    setHandsFree(e.target.checked);
                    if (e.target.checked && streaming === null) startListening(true);
                    else stopListening.current();
                  }}
                />{" "}
                Hands-free voice mode
              </label>
            )}
            <button className="btn secondary" onClick={finish} disabled={finishing || learnerTurns === 0 || streaming !== null}>
              {finishing ? "Evaluating…" : "Finish & save"}
            </button>
          </div>
          {finishing && <Spinner label="Writing your feedback…" />}
        </>
      )}
    </div>
  );
}

function applyDebrief(s: AppState, r: Debrief, mode: ChatMode, title: string): AppState {
  let next = addWords(s, r.new_words).state;
  next = recordErrors(next, r.top_errors);
  const score = (r.fluency + r.accuracy + r.range) / 3;
  return addLog(next, mode, `${title}: ${r.summary}`, score);
}

function finishConv(s: AppState, id: string, debrief: unknown): AppState {
  return {
    ...s,
    conversations: s.conversations.map((c) => (c.id === id ? { ...c, finished: true, debrief, updatedAt: Date.now() } : c)),
  };
}

function DebriefView({ conv }: { conv: Conversation }) {
  const d = conv.debrief as (Debrief & Partial<LessonResult>) | (Placement & { top_errors?: undefined }) | undefined;
  if (!d) return null;
  if (conv.mode === "placement") {
    const p = d as Placement;
    return (
      <Card title="Your placement result">
        <p>{p.summary}</p>
        <table className="levels">
          <tbody>
            {Object.entries(p.levels).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>
                  <b>{v}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {p.strengths.length > 0 && <p><b>Strengths:</b> {p.strengths.join("; ")}</p>}
        {p.focus_areas.length > 0 && <p><b>Focus on:</b> {p.focus_areas.join("; ")}</p>}
        <button className="btn" onClick={() => go("chat", `lesson:${p.start_unit}`)}>
          Start unit {p.start_unit}
        </button>
      </Card>
    );
  }
  const r = d as Debrief & Partial<LessonResult>;
  return (
    <Card title={conv.mode === "lesson" ? (r.passed ? "Lesson passed ✅" : "Lesson done: worth repeating") : "Debrief"}>
      <p>{r.summary}</p>
      <div className="stats small-stats">
        {r.lesson_score !== undefined && (
          <div className="stat">
            <b>{Math.round(r.lesson_score)}%</b>
            <span>drills</span>
          </div>
        )}
        <div className="stat">
          <b>{r.fluency}</b>
          <span>fluency</span>
        </div>
        <div className="stat">
          <b>{r.accuracy}</b>
          <span>accuracy</span>
        </div>
        <div className="stat">
          <b>{r.range}</b>
          <span>range</span>
        </div>
      </div>
      {r.top_errors.length > 0 && (
        <>
          <h3>Fix these</h3>
          <ul className="plain">
            {r.top_errors.map((e, i) => (
              <li key={i}>
                <s>{e.wrong}</s> → <b>{e.right}</b>
                <div className="small muted">{e.explanation}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.useful_phrases.length > 0 && (
        <>
          <h3>Useful phrases</h3>
          <ul className="plain">
            {r.useful_phrases.map((p, i) => (
              <li key={i}>
                <b>{p.de}</b> <span className="muted">· {p.en}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {r.new_words.length > 0 && (
        <>
          <h3>New words (added to your deck)</h3>
          <WordList words={r.new_words} />
        </>
      )}
      <div className="row">
        <button className="btn" onClick={() => go("review")}>
          Review words
        </button>
        <button className="btn secondary" onClick={() => go("chat")}>
          New conversation
        </button>
      </div>
    </Card>
  );
}
