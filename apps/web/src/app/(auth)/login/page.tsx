"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { getInitData, initTelegram, isTelegramEnvironment } from "@/lib/telegram";

type BootState = "checking" | "authenticating" | "telegram-no-data" | "browser";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, token } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [bootState, setBootState] = useState<BootState>("checking");

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "manticode_bot";
  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  useEffect(() => {
    if (token) { router.replace("/chat"); return; }

    let mounted = true;

    initTelegram().then(() => {
      if (!mounted) return;
      if (!isTelegramEnvironment()) { setBootState("browser"); return; }

      const initData = getInitData();
      if (!initData) { setBootState("telegram-no-data"); return; }

      setBootState("authenticating");
      login(initData)
        .then(() => router.replace("/chat"))
        .catch((e) => { setError(e.message); setBootState("telegram-no-data"); });
    });

    return () => { mounted = false; };
  }, [token, login, router]);

  const handleDevLogin = async () => {
    try { await login("dev-mode"); router.replace("/chat"); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-bg-primary p-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
          <rect width="64" height="64" rx="14" fill="#06060a" />
          <path d="M14 48L32 12L50 48H14Z" stroke="#f97316" strokeWidth="3.5" strokeLinejoin="round" fill="none" />
          <path d="M22 36H42" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M26 42H38" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <h1 className="text-2xl font-bold">Manticode</h1>
        <p className="text-sm text-text-secondary">AI coding assistant</p>
      </div>

      {error && (
        <div className="rounded-xl bg-danger/10 px-4 py-2 text-sm text-danger">{error}</div>
      )}

      {loading || bootState === "checking" || bootState === "authenticating" ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Authenticating...
        </div>
      ) : bootState === "browser" ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-text-tertiary">Open in Telegram for automatic login</p>
          <a
            href={`https://t.me/${botUsername}?startapp=1`}
            className="inline-flex items-center gap-2 rounded-xl bg-telegram px-6 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.28-.02-.12.03-2.02 1.28-5.69 3.77-.54.37-1.03.55-1.47.54-.48-.01-1.4-.27-2.09-.49-.84-.28-1.51-.42-1.45-.89.03-.25.38-.5 1.04-.76 4.09-1.78 6.81-2.96 8.18-3.52 3.9-1.62 4.7-1.9 5.23-1.91.12 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .38z" />
            </svg>
            Open in Telegram
          </a>
          {devLogin && (
            <button
              onClick={handleDevLogin}
              className="mt-2 rounded-lg border border-border px-4 py-2 text-xs text-text-tertiary transition-colors hover:border-border-light hover:text-text-secondary"
            >
              Dev Login
            </button>
          )}
        </div>
      ) : (
        <div className="flex max-w-xs flex-col items-center gap-3 text-center">
          <p className="text-xs text-text-tertiary">
            Open this app from @{botUsername} via the bot menu button.
          </p>
          <a
            href={`https://t.me/${botUsername}?startapp=1`}
            className="inline-flex items-center gap-2 rounded-xl bg-telegram px-6 py-2.5 text-sm font-semibold text-white"
          >
            Open Mini App
          </a>
        </div>
      )}
    </div>
  );
}
