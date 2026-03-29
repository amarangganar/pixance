// Structured logger. Dev: colorized human-readable lines. Prod (NODE_ENV=production): JSON.
//
// Usage:
//   import { log } from "../lib/logger";
//   const log = rootLog.child({ module: "[sheets]" });
//   log.info("transaction saved", { amount: 25000 });
//   log.error("sheets API failed", err, { spreadsheetId });

const isProd = process.env.NODE_ENV === "production";

type Level = "INFO" | "WARN" | "ERROR";

const LEVEL_COLORS: Record<Level, string> = {
  INFO: "\x1b[36m",  // cyan
  WARN: "\x1b[33m",  // yellow
  ERROR: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

function write(level: Level, msg: string, fields: Record<string, unknown>): void {
  if (isProd) {
    process.stdout.write(
      JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }) + "\n"
    );
  } else {
    const time = new Date().toTimeString().slice(0, 8);
    const color = LEVEL_COLORS[level];
    const module = typeof fields.module === "string" ? ` ${fields.module}` : "";
    const extra = Object.entries(fields)
      .filter(([k]) => k !== "module")
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("  ");
    const suffix = extra ? `  ${extra}` : "";
    process.stdout.write(`[${time}] ${color}${level}${RESET}${module} ${msg}${suffix}\n`);
  }
}

function extractErrorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { err: err.message, stack: err.stack };
  }
  if (err !== undefined && err !== null) {
    return { err: String(err) };
  }
  return {};
}

function makeLogger(baseContext: Record<string, unknown>): Logger {
  return {
    info(msg, fields = {}) {
      write("INFO", msg, { ...baseContext, ...fields });
    },
    warn(msg, fields = {}) {
      write("WARN", msg, { ...baseContext, ...fields });
    },
    error(msg, err, fields = {}) {
      write("ERROR", msg, { ...baseContext, ...extractErrorFields(err), ...fields });
    },
    child(context) {
      return makeLogger({ ...baseContext, ...context });
    },
  };
}

export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  /** Pass the caught error as the second argument — stack trace is extracted automatically. */
  error(msg: string, err?: unknown, fields?: Record<string, unknown>): void;
  /** Returns a new logger that includes `context` in every log entry. */
  child(context: Record<string, unknown>): Logger;
}

export const log: Logger = makeLogger({});
