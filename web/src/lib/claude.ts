import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

export type Effort = "low" | "medium" | "high";

export class TutorError extends Error {}

let cached: { key: string; client: Anthropic } | null = null;

function client(apiKey: string): Anthropic {
  if (!apiKey) throw new TutorError("Add your Anthropic API key in Settings first.");
  if (cached?.key !== apiKey) {
    // The key is the learner's own and never leaves their browser except to api.anthropic.com.
    cached = { key: apiKey, client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) };
  }
  return cached.client;
}

/** Server-side refusal fallback (Opus/Sonnet). Haiku has no server-side fallback. */
function fallbackParams(model: string) {
  if (model.startsWith("claude-haiku")) return {};
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
}

export function friendlyError(err: unknown): string {
  if (err instanceof TutorError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "Your API key was rejected. Check it in Settings.";
  if (err instanceof Anthropic.PermissionDeniedError) return "This API key isn't allowed to use that model.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limit reached. Wait a moment and try again.";
  if (err instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(err.message)) return "Your Anthropic account is out of credit. Add credit in the Claude Console.";
    return `The request was rejected: ${err.message}`;
  }
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach Claude. Check your internet connection.";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}: ${err.message}`;
  if (err instanceof z.ZodError) return "Claude's answer came back in an unexpected shape. Please try again.";
  if (err instanceof Error) return err.message;
  return String(err);
}

interface CallOpts {
  apiKey: string;
  model: string;
  system: string;
  effort?: Effort;
  signal?: AbortSignal;
}

/** Streams a tutor reply, calling onText with the full text so far. Returns the final text. */
export async function streamReply(
  opts: CallOpts & { messages: BetaMessageParam[]; onText: (text: string) => void },
): Promise<string> {
  const stream = client(opts.apiKey).beta.messages.stream(
    {
      model: opts.model,
      max_tokens: 16000,
      system: opts.system,
      messages: opts.messages,
      cache_control: { type: "ephemeral" },
      output_config: { effort: opts.effort ?? "low" },
      ...fallbackParams(opts.model),
    },
    { signal: opts.signal },
  );
  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      opts.onText(text);
    }
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    throw new TutorError("Claude declined to answer this one. Try rephrasing, or start a new conversation.");
  }
  return text;
}

function jsonSchema(schema: z.ZodType): { [key: string]: unknown } {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

/** One request whose answer must match a Zod schema (structured outputs). */
export async function structured<S extends z.ZodType>(
  schema: S,
  opts: CallOpts & { user: string; messages?: BetaMessageParam[] },
): Promise<z.infer<S>> {
  const stream = client(opts.apiKey).beta.messages.stream(
    {
      model: opts.model,
      max_tokens: 16000,
      system: opts.system,
      messages: [...(opts.messages ?? []), { role: "user", content: opts.user }],
      output_config: {
        effort: opts.effort ?? "medium",
        format: { type: "json_schema", schema: jsonSchema(schema) },
      },
      ...fallbackParams(opts.model),
    },
    { signal: opts.signal },
  );
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new TutorError("Claude declined this request. Please try again.");
  if (msg.stop_reason === "max_tokens") throw new TutorError("The answer was too long and got cut off. Try a shorter text.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return schema.parse(JSON.parse(text));
}
