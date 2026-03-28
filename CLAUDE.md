# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev          # start with hot reload (--watch)
bun start        # start without hot reload
```

No test runner is configured. Validate behavior against the acceptance criteria in `.docs/plan.md`.

## Architecture

Single-process Bun webhook server. No web dashboard, no REST API — only a Telegram Bot API webhook endpoint.

**Entry flow:**
`src/index.ts` → validates env → `initSheets()` → loads config cache → `setWebhook()` → `Bun.serve`

Every incoming POST hits `src/bot/index.ts`, which parses the Telegram update via Zod and routes to either `commands.ts` (slash commands) or `message.ts` (plain text).

**Layer responsibilities:**

- `src/bot/` — Telegram I/O only. `telegram.ts` is a thin typed `fetch` wrapper. `message.ts` owns the "analyzing..." placeholder pattern and the in-memory `PendingDelete` disambiguation state (`Map<chatId, PendingDelete>`).
- `src/ai/` — AI calls only via Vercel AI SDK (`ai` package, Vercel AI Gateway). `parser.ts` uses `generateObject` with `ParsedMessageSchema` for structured output. `advisor.ts` uses `generateText` for prose. Model is `gateway(process.env.AI_MODEL)`, defaulting to `anthropic/claude-sonnet-4-5`. `detectLanguage` lives here.
- `src/sheets/` — Google Sheets I/O only. `client.ts` holds auth; `transactions.ts` and `pockets.ts` own all reads/writes. All aggregation is done in TypeScript after fetching rows — never Sheets formulas.
- `src/services/` — orchestration. `transaction.ts` wires parse → write. `analytics.ts` builds `FinancialContext` from Sheets data.
- `src/schemas.ts` — single source of truth for all types. All types are inferred from Zod schemas here — never write manual `interface` or `type` declarations elsewhere for these shapes.

**Zod validation boundaries** — `safeParse` (never `parse`) at exactly three points:
1. Incoming Telegram webhook body
2. Claude parser output — `generateObject` uses `ParsedMessageSchema` directly; fallback to `{ intent: "unknown", confidence: 0 }` on error
3. Google Sheets row reads

Malformed data at any boundary is silently dropped — never throws, never crashes.

**Google Sheets structure:**
- `transactions` sheet: 9 columns (id, timestamp, type, amount, category, note, pocket, from_pocket, to_pocket). `Transaction` is a discriminated union on `type`.
- `meta` sheet: key-value rows. Reserved keys: `currency`, `timezone`, `pocket:[name]`.

**Config cache:** `currency` and `timezone` are loaded from meta once at startup into a module-level cache. All date formatting and currency display reads from the cache — never re-fetches.

**Pocket matching in parser:** exact match, case-insensitive. No partial/fuzzy matching. No match → default to first active pocket. Archived pockets are excluded from the active list passed to the parser.

**Delete disambiguation:** in-memory `Map<chatId, PendingDelete>`. Message handler checks for pending state before passing text to Claude. Wiped on restart.

## Key constraints

- **No Telegram inline buttons or keyboards.** Plain text replies only.
- **No balance tracking.** Flows only — never imply or calculate running balances per pocket.
- **No budget system.**
- Rename pocket does not backfill historical transactions — the name at transaction time is the historical record.
- `/report` month boundaries use the configured timezone (not UTC). Timestamps are stored as UTC ISO 8601.
- `/report` on any Sheets API failure: send full error, never partial data.
