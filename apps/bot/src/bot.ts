import Redis from "ioredis";
import { telegramApi, sendText, getBotToken } from "./telegram.js";
import { buildMessages, generateReply } from "./ai.js";

// ── Config ───────────────────────────────────────────

const MINIAPP_URL = process.env.TELEGRAM_MINIAPP_URL || "";
const GROUP_MODE = (process.env.TELEGRAM_BOT_GROUP_MODE || "mention").toLowerCase() as "mention" | "all";
const POLL_TIMEOUT = 5;
const RETRY_DELAY = 2_000;
const HISTORY_TTL = 24 * 60 * 60;
const HISTORY_TURNS = 8;
const LOCK_TTL = 45;
const MAX_PROMPT_CHARS = 8_000;

// ── Types ────────────────────────────────────────────

interface TGUser { id: number; is_bot: boolean; username?: string; first_name: string; }
interface TGChat { id: number; type: "private" | "group" | "supergroup" | "channel"; }
interface TGEntity { type: string; offset: number; length: number; }
interface TGMessage {
  message_id: number;
  text?: string;
  chat: TGChat;
  from?: TGUser;
  entities?: TGEntity[];
  reply_to_message?: { from?: TGUser };
}
interface TGUpdate { update_id: number; message?: TGMessage; }
interface BotTurn { user: string; assistant: string; }

// ── Helpers ──────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractCommand(msg: TGMessage, botUsername: string): string | null {
  if (!msg.text || !msg.entities?.length) return null;
  const entity = msg.entities.find((e) => e.type === "bot_command" && e.offset === 0);
  if (!entity) return null;
  const raw = msg.text.slice(0, entity.length);
  const [cmd, target] = raw.split("@");
  if (!cmd?.startsWith("/")) return null;
  if (target && target.toLowerCase() !== botUsername.toLowerCase()) return null;
  return cmd.toLowerCase();
}

function shouldRespondInGroup(msg: TGMessage, botUsername: string): boolean {
  if (!msg.text) return false;
  if (extractCommand(msg, botUsername)) return true;
  if (msg.text.startsWith("/")) return false;
  if (msg.text.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) return true;
  if (msg.reply_to_message?.from?.username?.toLowerCase() === botUsername.toLowerCase()) return true;
  return GROUP_MODE === "all";
}

function sanitizePrompt(text: string, botUsername: string): string {
  return text.replace(new RegExp(`@${botUsername}\\b`, "gi"), "").trim().slice(0, MAX_PROMPT_CHARS);
}

// ── History (Redis with in-memory fallback) ──────────

function historyKey(chatId: number) { return `manticode:history:${chatId}`; }
function lockKey(chatId: number) { return `manticode:lock:${chatId}`; }

async function loadHistory(redis: Redis | null, memoryHistory: Map<number, BotTurn[]>, chatId: number): Promise<BotTurn[]> {
  if (redis) {
    try {
      const raw = await redis.get(historyKey(chatId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { /* fall through to memory */ }
  }
  return memoryHistory.get(chatId) || [];
}

async function saveHistory(redis: Redis | null, memoryHistory: Map<number, BotTurn[]>, chatId: number, turns: BotTurn[]): Promise<void> {
  const trimmed = turns.slice(-HISTORY_TURNS);
  if (redis) {
    try {
      await redis.set(historyKey(chatId), JSON.stringify(trimmed), "EX", HISTORY_TTL);
      return;
    } catch { /* fall through to memory */ }
  }
  memoryHistory.set(chatId, trimmed);
}

async function clearHistory(redis: Redis | null, memoryHistory: Map<number, BotTurn[]>, chatId: number): Promise<void> {
  if (redis) {
    try { await redis.del(historyKey(chatId)); } catch { /* ignore */ }
  }
  memoryHistory.delete(chatId);
}

async function withLock<T>(redis: Redis | null, chatId: number, fn: () => Promise<T>): Promise<T | null> {
  if (!redis) return fn(); // No lock without Redis — just run it
  const acquired = await redis.set(lockKey(chatId), "1", "EX", LOCK_TTL, "NX");
  if (!acquired) return null;
  try { return await fn(); }
  finally { await redis.del(lockKey(chatId)); }
}

// ── Command handlers ─────────────────────────────────

function startMarkup() {
  if (!MINIAPP_URL) return undefined;
  return {
    inline_keyboard: [[{
      text: "Open Manticode",
      web_app: { url: MINIAPP_URL },
    }]],
  };
}

async function handleMessage(
  redis: Redis | null,
  memoryHistory: Map<number, BotTurn[]>,
  msg: TGMessage,
  botUsername: string,
): Promise<void> {
  if (!msg.text || msg.from?.is_bot || msg.chat.type === "channel") return;

  const cmd = extractCommand(msg, botUsername);
  const chatId = msg.chat.id;
  const msgId = msg.message_id;

  // ── /start
  if (cmd === "/start") {
    await sendText(chatId,
      "Hey! I'm *Manticode* — your AI coding assistant.\n\n" +
      "Ask me anything about code with `/ask`, or just message me directly.\n\n" +
      "Commands: `/ask` `/reset` `/help` `/ping`",
      { replyToMessageId: msgId, replyMarkup: startMarkup() },
    );
    return;
  }

  // ── /help
  if (cmd === "/help") {
    await sendText(chatId,
      "*Manticode Commands*\n\n" +
      "`/ask <question>` — Ask a coding question\n" +
      "`/reset` — Clear conversation history\n" +
      "`/ping` — Health check\n" +
      "`/help` — This message\n\n" +
      `In groups, mention @${botUsername} or reply to my messages.`,
      { replyToMessageId: msgId },
    );
    return;
  }

  // ── /ping
  if (cmd === "/ping") {
    await sendText(chatId, "pong 🏓", { replyToMessageId: msgId });
    return;
  }

  // ── /reset
  if (cmd === "/reset" || cmd === "/clear") {
    await clearHistory(redis, memoryHistory, chatId);
    await sendText(chatId,
      "Context cleared. Next message starts a fresh conversation.",
      { replyToMessageId: msgId },
    );
    return;
  }

  // ── Extract prompt
  let prompt = msg.text;

  if (cmd === "/ask") {
    const commandToken = msg.text.split(/\s+/, 1)[0] || "/ask";
    prompt = msg.text.slice(commandToken.length).trim();
  } else if (msg.chat.type === "group" || msg.chat.type === "supergroup") {
    if (!shouldRespondInGroup(msg, botUsername)) return;
    prompt = sanitizePrompt(prompt, botUsername);
  }

  if (!prompt.trim()) {
    await sendText(chatId, "Give me something to work with — send a prompt after `/ask` or mention me with a question.", { replyToMessageId: msgId });
    return;
  }

  // ── Generate AI reply (with lock to prevent concurrent requests per chat)
  const result = await withLock(redis, chatId, async () => {
    await telegramApi("sendChatAction", { chat_id: chatId, action: "typing" });

    const history = await loadHistory(redis, memoryHistory, chatId);
    const messages = buildMessages(history, prompt);

    let reply: string;
    try {
      reply = await generateReply(messages);
    } catch (err) {
      reply = `Error generating response: ${(err as Error).message}`;
    }

    reply = reply.trim() || "I couldn't generate a response for that.";
    await sendText(chatId, reply, { replyToMessageId: msgId });
    await saveHistory(redis, memoryHistory, chatId, [...history, { user: prompt, assistant: reply }]);
  });

  if (result === null) {
    await sendText(chatId,
      "Still working on the previous request — give me a sec.",
      { replyToMessageId: msgId },
    );
  }
}

// ── Main loop ────────────────────────────────────────

export async function startBot(): Promise<{ stop: () => Promise<void> }> {
  const token = getBotToken();
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return { stop: async () => {} };
  }

  let redis: Redis | null = null;
  try {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
    await redis.connect();
    console.log("Redis connected");
  } catch (err) {
    console.warn("Redis unavailable — running without conversation history:", (err as Error).message);
    redis = null;
  }

  // In-memory history fallback when Redis is down
  const memoryHistory = new Map<number, BotTurn[]>();

  const me = await telegramApi<TGUser>("getMe");
  const botUsername = me.username || "manticode_bot";

  await telegramApi("deleteWebhook", { drop_pending_updates: false });

  // Register commands
  try {
    await telegramApi("setMyCommands", {
      commands: [
        { command: "start", description: "Get started with Manticode" },
        { command: "ask", description: "Ask a coding question" },
        { command: "reset", description: "Clear conversation context" },
        { command: "help", description: "Show commands" },
        { command: "ping", description: "Health check" },
      ],
    });
  } catch (err) {
    console.warn("Failed to register commands:", err);
  }

  // Set Mini App menu button
  if (MINIAPP_URL) {
    try {
      await telegramApi("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "Open Manticode",
          web_app: { url: MINIAPP_URL },
        },
      });
    } catch (err) {
      console.warn("Failed to set menu button:", err);
    }
  }

  console.log(`Manticode bot started — @${botUsername} (group mode: ${GROUP_MODE})`);

  let stopped = false;
  let offset = 0;

  const loop = (async () => {
    while (!stopped) {
      try {
        const updates = await telegramApi<TGUpdate[]>("getUpdates", {
          timeout: POLL_TIMEOUT,
          offset,
          allowed_updates: ["message"],
        });

        for (const update of updates) {
          offset = update.update_id + 1;
          if (!update.message) continue;
          try {
            await handleMessage(redis, memoryHistory, update.message, botUsername);
          } catch (err) {
            console.error("Message handling error:", err);
            try {
              await sendText(update.message.chat.id,
                "Something went wrong processing that request.",
                { replyToMessageId: update.message.message_id },
              );
            } catch { /* double fault, ignore */ }
          }
        }
      } catch (err) {
        if (stopped) break;
        console.error("Polling error, retrying:", err);
        await sleep(RETRY_DELAY);
      }
    }
  })();

  return {
    stop: async () => {
      stopped = true;
      await loop.catch(() => {});
      if (redis) await redis.disconnect();
      console.log("Manticode bot stopped");
    },
  };
}
