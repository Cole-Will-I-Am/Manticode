/**
 * AI provider service — supports Ollama Cloud, OpenAI, and Anthropic streaming.
 *
 * Yields ChatChunk objects compatible with the SSE message route.
 */

const PROVIDER = (process.env.AI_PROVIDER || "ollama").toLowerCase();
const TIMEOUT_MS = 120_000;

// Ollama Cloud (OpenAI-compatible API)
const OLLAMA_KEY = process.env.OLLAMA_API_KEY || "";
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "https://ollama.com/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "nemotron-3-super";

// OpenAI
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// Anthropic
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const ANTHROPIC_MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS) || 4096;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatChunk {
  model: string;
  content: string;
  done: boolean;
  promptTokens?: number;
  completionTokens?: number;
}

// ── Ollama Cloud streaming (OpenAI-compatible) ───────

async function* streamOllama(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  const res = await fetch(`${OLLAMA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OLLAMA_KEY}`,
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: true,
    }),
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama Cloud ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") {
        yield { model: OLLAMA_MODEL, content: "", done: true, promptTokens, completionTokens };
        return;
      }
      try {
        const parsed = JSON.parse(payload);
        if (parsed.usage) {
          promptTokens = parsed.usage.prompt_tokens ?? 0;
          completionTokens = parsed.usage.completion_tokens ?? 0;
        }
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) {
          yield { model: OLLAMA_MODEL, content: delta, done: false };
        }
      } catch {
        // skip malformed
      }
    }
  }

  yield { model: OLLAMA_MODEL, content: "", done: true, promptTokens, completionTokens };
}

// ── OpenAI streaming ─────────────────────────────────

async function* streamOpenAI(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") {
        yield { model: OPENAI_MODEL, content: "", done: true, promptTokens, completionTokens };
        return;
      }
      try {
        const parsed = JSON.parse(payload);
        if (parsed.usage) {
          promptTokens = parsed.usage.prompt_tokens ?? 0;
          completionTokens = parsed.usage.completion_tokens ?? 0;
        }
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) {
          yield { model: OPENAI_MODEL, content: delta, done: false };
        }
      } catch {
        // skip malformed
      }
    }
  }

  yield { model: OPENAI_MODEL, content: "", done: true, promptTokens, completionTokens };
}

// ── Anthropic streaming ──────────────────────────────

async function* streamAnthropic(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  const systemParts: string[] = [];
  const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      apiMessages.push({ role: m.role as "user" | "assistant", content: m.content });
    }
  }

  // Merge consecutive same-role messages (Anthropic requirement)
  const merged: typeof apiMessages = [];
  for (const m of apiMessages) {
    if (merged.length > 0 && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += "\n\n" + m.content;
    } else {
      merged.push({ ...m });
    }
  }

  // Ensure first message is from user
  if (merged.length === 0 || merged[0].role !== "user") {
    merged.unshift({ role: "user", content: "Hello" });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemParts.join("\n\n") || undefined,
      messages: merged,
      stream: true,
    }),
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(trimmed.slice(6));

        if (event.type === "content_block_delta" && event.delta?.text) {
          yield { model: ANTHROPIC_MODEL, content: event.delta.text, done: false };
        }
        if (event.type === "message_start" && event.message?.usage) {
          promptTokens = event.message.usage.input_tokens ?? 0;
        }
        if (event.type === "message_delta" && event.usage) {
          completionTokens = event.usage.output_tokens ?? 0;
        }
        if (event.type === "message_stop") {
          yield { model: ANTHROPIC_MODEL, content: "", done: true, promptTokens, completionTokens };
          return;
        }
      } catch {
        // skip malformed
      }
    }
  }

  yield { model: ANTHROPIC_MODEL, content: "", done: true, promptTokens, completionTokens };
}

// ── Public API ───────────────────────────────────────

export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  if (PROVIDER === "anthropic") {
    yield* streamAnthropic(messages, signal);
  } else if (PROVIDER === "openai") {
    yield* streamOpenAI(messages, signal);
  } else {
    yield* streamOllama(messages, signal);
  }
}

export function getModelName(): string {
  if (PROVIDER === "anthropic") return ANTHROPIC_MODEL;
  if (PROVIDER === "openai") return OPENAI_MODEL;
  return OLLAMA_MODEL;
}
