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
  "OWNER_CHAT_ID",
] as const;

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ─── Imports after validation ─────────────────────────────────────────────────

import { startServer } from "./bot/index";
import { setMyCommands, setWebhook } from "./bot/telegram";
import { loadConfig } from "./config";
import { log } from "./lib/logger";
import { initSheets, initSheetsClient, readConfigFromMeta } from "./sheets/client";

// ─── Startup sequence ─────────────────────────────────────────────────────────

try {
  initSheetsClient();
} catch (err) {
  log.error("[startup] initSheetsClient failed", err);
  process.exit(1);
}

try {
  await initSheets();
} catch (err) {
  log.error("[startup] initSheets failed", err);
  process.exit(1);
}

try {
  const { currency, timezone } = await readConfigFromMeta();
  loadConfig(currency, timezone);
} catch (err) {
  log.error("[startup] readConfigFromMeta failed", err);
  process.exit(1);
}

try {
  await setWebhook(process.env.WEBHOOK_URL ?? "");
} catch (err) {
  log.error("[startup] setWebhook failed", err);
  process.exit(1);
}

try {
  await setMyCommands();
} catch (err) {
  log.warn("[startup] setMyCommands failed — bot commands menu may be outdated", { err: String(err) });
}

const server = startServer();
const port = process.env.PORT ?? 3000;
log.info("startup complete", { port });

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});
