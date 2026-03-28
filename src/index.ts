import { config } from "dotenv";

// Bun auto-loads .env before the process starts; this call is a defensive
// fallback for other runtimes or non-standard .env locations.
config();

// ─── Env validation — fail fast with a specific message per missing var ───────

const REQUIRED_VARS = [
  "BOT_TOKEN",
  "AI_GATEWAY_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "SPREADSHEET_ID",
  "WEBHOOK_URL",
] as const;

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ─── Imports after validation ─────────────────────────────────────────────────

import { startServer } from "./bot/index";
import { setWebhook } from "./bot/telegram";
import { loadConfig } from "./config";
import { initSheets, initSheetsClient, readConfigFromMeta } from "./sheets/client";

// ─── Startup sequence ─────────────────────────────────────────────────────────

initSheetsClient();

await initSheets();

const { currency, timezone } = await readConfigFromMeta();
loadConfig(currency, timezone);

await setWebhook(process.env.WEBHOOK_URL ?? "");

const server = startServer();
console.log(`🧚 Pixance is live! Listening on port ${process.env.PORT ?? 3000}`);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});
