import { startBot } from "./bot.js";

async function main() {
  const bot = await startBot();

  const shutdown = async (signal: string) => {
    console.log(`${signal} received — shutting down bot`);
    await bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
