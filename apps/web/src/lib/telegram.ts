"use client";

import {
  init,
  miniApp,
  viewport,
  initData,
  type User as TGUser,
} from "@telegram-apps/sdk-react";

const BG = "#06060a";

export async function initTelegram() {
  try {
    init();
    if (viewport.mount.isAvailable()) {
      await viewport.mount();
      if (viewport.expand.isAvailable()) viewport.expand();
    }
    if (miniApp.setHeaderColor.isAvailable()) miniApp.setHeaderColor(BG);
    if (miniApp.setBackgroundColor.isAvailable()) miniApp.setBackgroundColor(BG);
  } catch {
    console.warn("Telegram SDK init failed — running in browser mode");
  }
}

export function getInitData(): string | null {
  try { return initData.raw() ?? null; } catch { return null; }
}

export function getTelegramUser(): TGUser | null {
  try { return initData.user() ?? null; } catch { return null; }
}

export function isTelegramEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hash.includes("tgWebAppData") ||
    navigator.userAgent.includes("TelegramBot") ||
    !!getInitData()
  );
}
