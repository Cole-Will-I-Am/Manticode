/**
 * Standalone AI client for the bot.
 * Uses the same Ollama Cloud / OpenAI-compatible endpoint as the API server.
 * This avoids the bot needing to depend on Fastify or Prisma.
 */

const PROVIDER = (process.env.AI_PROVIDER || "ollama").toLowerCase();
const TIMEOUT_MS = 120_000;

// Ollama Cloud
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

const SYSTEM_PROMPT = `You are **Manticode** — an expert AI coding assistant built by ManticThink. You live inside Telegram as a bot, helping developers write, debug, refactor, and ship code.

You're sharp, direct, and knowledgeable — the senior engineer on the team. Concise but thorough, opinionated when it matters, always practical. No fluff.

Keep responses Telegram-friendly:
- Use Markdown formatting (bold, code blocks, inline code)
- Keep answers focused — no walls of text
- For code, use fenced code blocks with the language specified
- In group chats, be extra concise
- When asked about yourself: you're Manticode by ManticThink, available at manticthink.com and as a Telegram Mini App`;

// ── OpenAI-compatible streaming (Ollama Cloud + OpenAI) ──

async function streamOpenAICompat(
  base: string,
  key: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices?.[0]?.message?.content || "";
}

// ── Anthropic non-streaming ──

async function callAnthropic(messages: ChatMessage[]): Promise<string> {
  const systemParts: string[] = [];
  const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else apiMessages.push({ role: m.role as "user" | "assistant", content: m.content });
  }

  // Merge consecutive same-role
  const merged: typeof apiMessages = [];
  for (const m of apiMessages) {
    if (merged.length > 0 && merged[merged.length - 1].role === m.role) {
      merged[merged.length - 1].content += "\n\n" + m.content;
    } else {
      merged.push({ ...m });
    }
  }
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
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text?: string }>;
  };
  return data.content?.find((c) => c.type === "text")?.text || "";
}

// ── Public API ──

export function buildMessages(
  history: Array<{ user: string; assistant: string }>,
  userMessage: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  for (const turn of history) {
    messages.push({ role: "user", content: turn.user });
    messages.push({ role: "assistant", content: turn.assistant });
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

export async function generateReply(messages: ChatMessage[]): Promise<string> {
  if (PROVIDER === "anthropic") {
    return callAnthropic(messages);
  } else if (PROVIDER === "openai") {
    return streamOpenAICompat(OPENAI_BASE, OPENAI_KEY, OPENAI_MODEL, messages);
  } else {
    return streamOpenAICompat(OLLAMA_BASE, OLLAMA_KEY, OLLAMA_MODEL, messages);
  }
}

export function getModelName(): string {
  if (PROVIDER === "anthropic") return ANTHROPIC_MODEL;
  if (PROVIDER === "openai") return OPENAI_MODEL;
  return OLLAMA_MODEL;
}
