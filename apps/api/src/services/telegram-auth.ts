import { createHmac } from "crypto";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const MAX_AGE_SECONDS = 300;
const DEV_AUTH = process.env.TELEGRAM_DEV_AUTH === "true";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface ValidatedInitData {
  user: TelegramUser;
  authDate: number;
}

export function validateInitData(initData: string): ValidatedInitData {
  // Dev bypass
  if (initData === "dev-mode") {
    if (!DEV_AUTH) throw new Error("Dev auth is disabled");
    return {
      user: { id: 999999, first_name: "Dev", username: "devuser" },
      authDate: Math.floor(Date.now() / 1000),
    };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash");

  params.delete("hash");
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (computed !== hash) throw new Error("Invalid signature");

  const authDate = parseInt(params.get("auth_date") || "0", 10);
  if (Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SECONDS) {
    throw new Error("initData expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Missing user");

  return { user: JSON.parse(userRaw), authDate };
}
