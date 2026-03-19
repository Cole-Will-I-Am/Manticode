const TELEGRAM_API = "https://api.telegram.org";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

interface TelegramApiResponse<T> {
  ok: boolean;
  description?: string;
  result: T;
}

export async function telegramApi<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`Telegram HTTP ${res.status} ${res.statusText}`);
  }

  const payload = (await res.json()) as TelegramApiResponse<T>;
  if (!payload.ok) {
    throw new Error(payload.description || `Telegram API error on ${method}`);
  }
  return payload.result;
}

// ── Message sending ──────────────────────────────────

const TEXT_LIMIT = 4096;

function splitMessage(text: string): string[] {
  if (text.length <= TEXT_LIMIT) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > TEXT_LIMIT) {
    const slice = remaining.slice(0, TEXT_LIMIT);
    const breakAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
    const idx = breakAt > TEXT_LIMIT * 0.6 ? breakAt : TEXT_LIMIT;
    chunks.push(remaining.slice(0, idx).trimEnd());
    remaining = remaining.slice(idx).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

async function sendChunk(
  chatId: number,
  text: string,
  extra: Record<string, unknown>,
): Promise<void> {
  try {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...extra,
    });
  } catch {
    // Markdown parse failure — retry as plain text
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text,
      ...extra,
    });
  }
}

export async function sendText(
  chatId: number,
  text: string,
  options: { replyToMessageId?: number; replyMarkup?: Record<string, unknown> } = {},
): Promise<void> {
  const chunks = splitMessage(text);
  for (let i = 0; i < chunks.length; i++) {
    await sendChunk(chatId, chunks[i], {
      reply_to_message_id: i === 0 ? options.replyToMessageId : undefined,
      allow_sending_without_reply: true,
      reply_markup: i === 0 ? options.replyMarkup : undefined,
    });
  }
}

export function getBotToken(): string {
  return BOT_TOKEN;
}
