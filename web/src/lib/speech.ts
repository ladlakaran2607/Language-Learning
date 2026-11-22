// Browser speech: text-to-speech (speechSynthesis) and speech-to-text (Web Speech API).

export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function germanVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("de"));
}

/** Strip Markdown, emoji markers and correction lines so only the German reply is read aloud. */
export function speakable(text: string): string {
  return text
    .split("\n")
    .filter((l) => !l.trim().startsWith("✏️"))
    .join(" ")
    .replace(/[*_`#>|]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[✅❌]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text: string, opts: { rate?: number; voiceName?: string; onEnd?: () => void } = {}) {
  if (!ttsSupported()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = "de-DE";
  u.rate = opts.rate ?? 0.9;
  const voices = germanVoices();
  const voice = voices.find((v) => v.name === opts.voiceName) ?? voices.find((v) => v.lang === "de-DE") ?? voices[0];
  if (voice) u.voice = voice;
  if (opts.onEnd) u.onend = opts.onEnd;
  speechSynthesis.speak(u);
}

export const stopSpeaking = () => ttsSupported() && speechSynthesis.cancel();

// Minimal typing for the (still vendor-prefixed in Safari) SpeechRecognition API.
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null;
}

export const sttSupported = () => typeof window !== "undefined" && recognitionCtor() !== null;

/** Listen for one German utterance. onText gets interim text; onDone the final transcript. */
export function listen(handlers: {
  onText: (t: string) => void;
  onDone: (t: string) => void;
  onError: (msg: string) => void;
}): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError("Speech recognition isn't supported in this browser. Use Chrome, Edge or Safari, or your keyboard's mic button.");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = false;
  let transcript = "";
  rec.onresult = (e) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    transcript = text;
    handlers.onText(text);
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    handlers.onError(e.error === "not-allowed" ? "Microphone permission was denied." : `Speech error: ${e.error}`);
  };
  rec.onend = () => handlers.onDone(transcript.trim());
  rec.start();
  return () => rec.stop();
}
