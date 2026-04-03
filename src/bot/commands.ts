import type { Pocket, Transaction } from "../schemas";
import { getAdvice, getQuickSummary } from "../ai/advisor";
import type { Logger } from "../lib/logger";
import { buildFinancialContext } from "../services/analytics";
import {
  addPocket,
  archivePocket,
  getAllPockets,
  getActivePocketNames,
  renamePocket,
  restorePocket,
} from "../sheets/pockets";
import { deleteTransaction, getAllTransactions, getRecentTransactions } from "../sheets/transactions";
import { getCurrentMonthYear, isInMonth, isInWeek, isToday } from "../utils/format";
import { formatDeleteConfirmation, formatHistory, formatReport, type ReportData } from "./format";
import { deleteMessage, sendMessage } from "./telegram";
import { stripMarkdown, toTelegramMarkdownV2 } from "../utils/format";

// ─── Argument parsing ─────────────────────────────────────────────────────────

/**
 * Splits a raw argument string into tokens, respecting single- and double-quoted
 * phrases with spaces. E.g. `BCA "BCA Syariah"` → `["BCA", "BCA Syariah"]`.
 */
export function parseArgs(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const ch of trimmed) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === " ") {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) args.push(current);
  return args;
}

// ─── Pocket list formatter ────────────────────────────────────────────────────

/**
 * Formats an array of pockets into a human-readable list.
 * When `showAll` is true, archived pockets are included and labeled.
 */
export function formatPocketList(pockets: Pocket[], showAll: boolean): string {
  const visible = showAll ? pockets : pockets.filter((p) => p.status === "active");
  if (visible.length === 0) return "No pockets found.";
  return visible
    .map((p) => (p.status === "archived" ? `• ${p.name} [archived]` : `• ${p.name}`))
    .join("\n");
}

// ─── Command router ───────────────────────────────────────────────────────────

export async function handleCommand(chatId: number, text: string, log: Logger): Promise<void> {
  // Extract base command (e.g. "/pockets all" → "/pockets", args = ["all"])
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const rawArgs = parts.slice(1).join(" ");
  const args = parseArgs(rawArgs);

  switch (command) {
    case "/start":
      return handleStart(chatId, log);
    case "/report":
      return handleReport(chatId, args, log);
    case "/history":
      return handleHistory(chatId, args, log);
    case "/pockets":
      return handlePockets(chatId, args, log);
    case "/addpocket":
      return handleAddPocket(chatId, args, log);
    case "/renamepocket":
      return handleRenamePocket(chatId, args, log);
    case "/archivepocket":
      return handleArchivePocket(chatId, args, log);
    case "/restorepocket":
      return handleRestorePocket(chatId, args, log);
    case "/delete":
      return handleDelete(chatId, args, log);
    case "/advice":
      return handleAdvice(chatId, args, log);
    default:
      await sendMessage(chatId, "Unknown command. Use /start to see available commands.");
  }
}

// ─── /report ──────────────────────────────────────────────────────────────────

async function handleReport(chatId: number, args: string[], log: Logger): Promise<void> {
  const PERIODS = ["today", "week", "month"] as const;
  type Period = (typeof PERIODS)[number];

  let period: Period = "today";
  let lang: "id" | "en" = "en";

  if (args[0] && (PERIODS as readonly string[]).includes(args[0])) {
    period = args[0] as Period;
    lang = args[1]?.toLowerCase() === "id" ? "id" : "en";
  } else {
    // backward compat: /report [lang]
    lang = args[0]?.toLowerCase() === "id" ? "id" : "en";
  }

  const { month, year } = getCurrentMonthYear();
  const placeholder = lang === "id" ? "⏳ Menyiapkan laporan..." : "⏳ Preparing report...";
  const { message_id: placeholderId } = await sendMessage(chatId, placeholder);

  let txs: Transaction[];
  let activePockets: string[];
  try {
    [txs, activePockets] = await Promise.all([getAllTransactions(), getActivePocketNames()]);
  } catch (err) {
    log.error("handler failed", err, { command: "/report" });
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, `❌ Failed to fetch data: ${String(err)}`);
    return;
  }

  const filterFn =
    period === "today" ? (tx: Transaction) => isToday(tx.timestamp) :
    period === "week"  ? (tx: Transaction) => isInWeek(tx.timestamp) :
    (tx: Transaction) => isInMonth(tx.timestamp, month, year);

  const periodTxs = txs.filter(filterFn);

  const data: ReportData = {
    period,
    month,
    year,
    totalIncome: 0,
    totalExpense: 0,
    totalTransferred: 0,
    categoryBreakdown: [],
    pocketBreakdown: [],
  };

  // Pass 1: all-time pocket net balance across entire history
  const allTimePocketMap = new Map<string, { totalIn: number; totalOut: number }>();
  const allTimePocket = (name: string) => {
    if (!allTimePocketMap.has(name)) allTimePocketMap.set(name, { totalIn: 0, totalOut: 0 });
    return allTimePocketMap.get(name)!;
  };
  for (const tx of txs) {
    if (tx.type === "income") allTimePocket(tx.pocket).totalIn += tx.amount;
    else if (tx.type === "expense") allTimePocket(tx.pocket).totalOut += tx.amount;
    else {
      allTimePocket(tx.from_pocket).totalOut += tx.amount;
      allTimePocket(tx.to_pocket).totalIn += tx.amount;
    }
  }

  // Pass 2: period-specific aggregation
  const catMap = new Map<string, { total: number; count: number }>();
  const periodPocketMap = new Map<string, { totalOut: number }>();
  for (const tx of periodTxs) {
    if (tx.type === "income") {
      data.totalIncome += tx.amount;
      const cat = catMap.get(tx.category) ?? { total: 0, count: 0 };
      cat.total += tx.amount;
      cat.count += 1;
      catMap.set(tx.category, cat);
    } else if (tx.type === "expense") {
      data.totalExpense += tx.amount;
      const cat = catMap.get(tx.category) ?? { total: 0, count: 0 };
      cat.total += tx.amount;
      cat.count += 1;
      catMap.set(tx.category, cat);
      const p = periodPocketMap.get(tx.pocket) ?? { totalOut: 0 };
      p.totalOut += tx.amount;
      periodPocketMap.set(tx.pocket, p);
    } else {
      data.totalTransferred += tx.amount;
      const p = periodPocketMap.get(tx.from_pocket) ?? { totalOut: 0 };
      p.totalOut += tx.amount;
      periodPocketMap.set(tx.from_pocket, p);
    }
  }

  data.categoryBreakdown = [...catMap.entries()].map(([category, { total, count }]) => ({ category, total, count }));
  data.pocketBreakdown = activePockets.map((name) => {
    const at = allTimePocketMap.get(name) ?? { totalIn: 0, totalOut: 0 };
    const net = at.totalIn - at.totalOut;
    return {
      pocket: name,
      balance: Math.max(0, net),
      overdrawn: net < 0 ? -net : 0,
      used: periodPocketMap.get(name)?.totalOut ?? 0,
    };
  });

  await deleteMessage(chatId, placeholderId).catch(() => {});
  await sendMessage(chatId, formatReport(data, lang), { parse_mode: "Markdown" });
}

// ─── /history ─────────────────────────────────────────────────────────────────

async function handleHistory(chatId: number, args: string[], log: Logger): Promise<void> {
  const lang: "id" | "en" = args[0]?.toLowerCase() === "id" ? "id" : "en";
  const placeholder = lang === "id" ? "⏳ Mengambil riwayat..." : "⏳ Fetching history...";
  const { message_id: placeholderId } = await sendMessage(chatId, placeholder);

  let txs: Transaction[];
  try {
    txs = await getRecentTransactions(10);
  } catch (err) {
    log.error("handler failed", err, { command: "/history" });
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, `❌ Failed to fetch transactions: ${String(err)}`);
    return;
  }

  await deleteMessage(chatId, placeholderId).catch(() => {});
  await sendMessage(chatId, formatHistory(txs, lang), { parse_mode: "Markdown" });
}

// ─── /start ───────────────────────────────────────────────────────────────────

async function handleStart(chatId: number, log: Logger): Promise<void> {
  let pocketList = "Main";
  try {
    const pockets = await getActivePocketNames();
    if (pockets.length > 0) pocketList = pockets.join(", ");
  } catch (err) {
    log.error("handler failed", err, { command: "/start", step: "getActivePocketNames" });
  }

  const text = [
    "🧚 *Pixance* is live!",
    "",
    "*Commands:*",
    "/report [today|week|month] [id|en] — summary with category & pocket breakdown (default: today)",
    "/history — last 10 transactions",
    "/pockets — list active pockets",
    "/pockets all — all pockets including archived",
    "/addpocket [name] — add a pocket",
    "/renamepocket [old] [new] — rename a pocket",
    "/archivepocket [name] — archive a pocket",
    "/restorepocket [name] — restore archived pocket",
    "/delete [n] — delete nth entry from /history",
    "/advice — AI financial advice",
    "",
    "*Examples:*",
    "`kopi 25rb pake gopay`",
    "`makan siang 50rb`",
    "`gajian 8jt ke BCA`",
    "`freelance project 3jt`",
    "`transfer BCA ke Gopay 1jt`",
    "`gimana kondisi keuangan aku bulan ini?`",
    "`how's my spending this month?`",
    "",
    `*Active pockets:* ${pocketList}`,
  ].join("\n");

  await sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// ─── /pockets ─────────────────────────────────────────────────────────────────

async function handlePockets(chatId: number, args: string[], log: Logger): Promise<void> {
  const showAll = args[0]?.toLowerCase() === "all";
  try {
    const pockets = await getAllPockets();
    const list = formatPocketList(pockets, showAll);
    const header = showAll ? "*All pockets:*" : "*Active pockets:*";
    await sendMessage(chatId, `${header}\n${list}`, { parse_mode: "Markdown" });
  } catch (err) {
    log.error("handler failed", err, { command: "/pockets" });
    await sendMessage(chatId, `❌ Failed to fetch pockets: ${String(err)}`);
  }
}

// ─── /addpocket ───────────────────────────────────────────────────────────────

async function handleAddPocket(chatId: number, args: string[], log: Logger): Promise<void> {
  const name = args[0]?.trim();
  if (!name) {
    await sendMessage(chatId, "❌ Usage: /addpocket [name]");
    return;
  }
  if (name.length > 32) {
    await sendMessage(chatId, "❌ Pocket name must be 32 characters or fewer.");
    return;
  }
  try {
    await addPocket(name);
    await sendMessage(chatId, `✅ Pocket "${name}" added`);
  } catch (err) {
    log.error("handler failed", err, { command: "/addpocket", name });
    const msg = err instanceof Error ? err.message : "Failed to add pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}

// ─── /renamepocket ────────────────────────────────────────────────────────────

async function handleRenamePocket(chatId: number, args: string[], log: Logger): Promise<void> {
  const oldName = args[0]?.trim();
  const newName = args[1]?.trim();
  if (!oldName || !newName) {
    await sendMessage(chatId, '❌ Usage: /renamepocket [old] [new] (quote names with spaces: /renamepocket BCA "BCA Syariah")');
    return;
  }
  if (newName.length > 32) {
    await sendMessage(chatId, "❌ Pocket name must be 32 characters or fewer.");
    return;
  }
  try {
    await renamePocket(oldName, newName);
    await sendMessage(
      chatId,
      `✅ Pocket renamed: "${oldName}" → "${newName}"\n_Note: historical transactions still show the old name._`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    log.error("handler failed", err, { command: "/renamepocket", oldName, newName });
    const msg = err instanceof Error ? err.message : "Failed to rename pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}

// ─── /archivepocket ──────────────────────────────────────────────────────────

async function handleArchivePocket(chatId: number, args: string[], log: Logger): Promise<void> {
  const name = args[0]?.trim();
  if (!name) {
    await sendMessage(chatId, "❌ Usage: /archivepocket [name]");
    return;
  }
  try {
    await archivePocket(name);
    await sendMessage(
      chatId,
      `✅ Pocket "${name}" archived. To undo: /restorepocket ${name}`,
    );
  } catch (err) {
    log.error("handler failed", err, { command: "/archivepocket", name });
    const msg = err instanceof Error ? err.message : "Failed to archive pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}

// ─── /restorepocket ──────────────────────────────────────────────────────────

async function handleRestorePocket(chatId: number, args: string[], log: Logger): Promise<void> {
  const name = args[0]?.trim();
  if (!name) {
    await sendMessage(chatId, "❌ Usage: /restorepocket [name]");
    return;
  }
  try {
    await restorePocket(name);
    await sendMessage(chatId, `✅ Pocket "${name}" restored`);
  } catch (err) {
    log.error("handler failed", err, { command: "/restorepocket", name });
    const msg = err instanceof Error ? err.message : "Failed to restore pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}

// ─── /advice ──────────────────────────────────────────────────────────────────

async function handleAdvice(chatId: number, args: string[], log: Logger): Promise<void> {
  const lang: "id" | "en" = args[0]?.toLowerCase() === "id" ? "id" : "en";
  const { month, year } = getCurrentMonthYear();
  const placeholder = lang === "id" ? "⏳ Menganalisis keuangan kamu..." : "⏳ Analyzing your finances...";
  const { message_id: placeholderId } = await sendMessage(chatId, placeholder);

  try {
    const ctx = await buildFinancialContext(lang, month, year);
    const advice = await getQuickSummary(ctx);
    await deleteMessage(chatId, placeholderId).catch(() => {});
    try {
      await sendMessage(chatId, toTelegramMarkdownV2(advice), { parse_mode: "MarkdownV2" });
    } catch {
      await sendMessage(chatId, stripMarkdown(advice));
    }
  } catch (err) {
    log.error("handler failed", err, { command: "/advice" });
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, `❌ Failed to fetch financial analysis: ${String(err)}`);
  }
}

// ─── /delete ──────────────────────────────────────────────────────────────────

async function handleDelete(chatId: number, args: string[], log: Logger): Promise<void> {
  const nRaw = args[0];
  const n = nRaw ? parseInt(nRaw, 10) : NaN;
  if (Number.isNaN(n) || n < 1) {
    await sendMessage(chatId, "❌ Usage: /delete [n] — use /history to see available entries.");
    return;
  }

  const { message_id: placeholderId } = await sendMessage(chatId, "⏳ Deleting...");

  let txs: Transaction[];
  try {
    txs = await getRecentTransactions(10);
  } catch (err) {
    log.error("handler failed", err, { command: "/delete", step: "fetch" });
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, `❌ Failed to fetch transactions: ${String(err)}`);
    return;
  }

  if (n > txs.length) {
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, "❌ Invalid number. Use /history to see available entries.");
    return;
  }

  const tx = txs[n - 1];
  try {
    await deleteTransaction(tx.id);
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, formatDeleteConfirmation(tx, "en"), { parse_mode: "Markdown" });
  } catch (err) {
    log.error("handler failed", err, { command: "/delete", txId: tx.id });
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, `❌ Failed to delete: ${String(err)}`);
  }
}
