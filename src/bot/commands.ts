import type { Pocket, Transaction } from "../schemas";
import {
  addPocket,
  archivePocket,
  getAllPockets,
  getActivePocketNames,
  renamePocket,
  restorePocket,
} from "../sheets/pockets";
import { getAllTransactions, getRecentTransactions } from "../sheets/transactions";
import { getCurrentMonthYear, isInMonth } from "../utils/format";
import { formatHistory, formatReport, type ReportData } from "./format";
import { deleteMessage, sendMessage } from "./telegram";

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

export async function handleCommand(chatId: number, text: string): Promise<void> {
  // Extract base command (e.g. "/pockets all" → "/pockets", args = ["all"])
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const rawArgs = parts.slice(1).join(" ");
  const args = parseArgs(rawArgs);

  switch (command) {
    case "/start":
      return handleStart(chatId);
    case "/report":
      return handleReport(chatId, args);
    case "/history":
      return handleHistory(chatId, args);
    case "/pockets":
      return handlePockets(chatId, args);
    case "/addpocket":
      return handleAddPocket(chatId, args);
    case "/renamepocket":
      return handleRenamePocket(chatId, args);
    case "/archivepocket":
      return handleArchivePocket(chatId, args);
    case "/restorepocket":
      return handleRestorePocket(chatId, args);
    default:
      await sendMessage(chatId, "Unknown command. Use /start to see available commands.");
  }
}

// ─── /report ──────────────────────────────────────────────────────────────────

async function handleReport(chatId: number, args: string[]): Promise<void> {
  const lang: "id" | "en" = args[0]?.toLowerCase() === "id" ? "id" : "en";
  const { month, year } = getCurrentMonthYear();
  const placeholder = lang === "id" ? "⏳ Menyiapkan laporan..." : "⏳ Preparing report...";
  const { message_id: placeholderId } = await sendMessage(chatId, placeholder);

  let txs: Transaction[];
  try {
    txs = await getAllTransactions();
  } catch (err) {
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, `❌ Failed to fetch transactions: ${String(err)}`);
    return;
  }

  const monthly = txs.filter((tx) => isInMonth(tx.timestamp, month, year));

  const data: ReportData = {
    month,
    year,
    totalIncome: 0,
    totalExpense: 0,
    totalTransferred: 0,
    categoryBreakdown: [],
    pocketBreakdown: [],
  };

  const catMap = new Map<string, { total: number; count: number }>();
  const pocketMap = new Map<string, { totalIn: number; totalOut: number }>();
  const pocket = (name: string) => {
    if (!pocketMap.has(name)) pocketMap.set(name, { totalIn: 0, totalOut: 0 });
    return pocketMap.get(name)!;
  };

  for (const tx of monthly) {
    if (tx.type === "income") {
      data.totalIncome += tx.amount;
      const cat = catMap.get(tx.category) ?? { total: 0, count: 0 };
      cat.total += tx.amount;
      cat.count += 1;
      catMap.set(tx.category, cat);
      pocket(tx.pocket).totalIn += tx.amount;
    } else if (tx.type === "expense") {
      data.totalExpense += tx.amount;
      const cat = catMap.get(tx.category) ?? { total: 0, count: 0 };
      cat.total += tx.amount;
      cat.count += 1;
      catMap.set(tx.category, cat);
      pocket(tx.pocket).totalOut += tx.amount;
    } else {
      data.totalTransferred += tx.amount;
      pocket(tx.from_pocket).totalOut += tx.amount;
      pocket(tx.to_pocket).totalIn += tx.amount;
    }
  }

  data.categoryBreakdown = [...catMap.entries()].map(([category, { total, count }]) => ({ category, total, count }));
  data.pocketBreakdown = [...pocketMap.entries()].map(([p, { totalIn, totalOut }]) => ({ pocket: p, totalIn, totalOut }));

  await deleteMessage(chatId, placeholderId).catch(() => {});
  await sendMessage(chatId, formatReport(data, lang), { parse_mode: "Markdown" });
}

// ─── /history ─────────────────────────────────────────────────────────────────

async function handleHistory(chatId: number, args: string[]): Promise<void> {
  const lang: "id" | "en" = args[0]?.toLowerCase() === "id" ? "id" : "en";
  const placeholder = lang === "id" ? "⏳ Mengambil riwayat..." : "⏳ Fetching history...";
  const { message_id: placeholderId } = await sendMessage(chatId, placeholder);

  let txs: Transaction[];
  try {
    txs = await getRecentTransactions(10);
  } catch (err) {
    await deleteMessage(chatId, placeholderId).catch(() => {});
    await sendMessage(chatId, `❌ Failed to fetch transactions: ${String(err)}`);
    return;
  }

  await deleteMessage(chatId, placeholderId).catch(() => {});
  await sendMessage(chatId, formatHistory(txs, lang), { parse_mode: "Markdown" });
}

// ─── /start ───────────────────────────────────────────────────────────────────

async function handleStart(chatId: number): Promise<void> {
  const pockets = await getActivePocketNames();
  const pocketList = pockets.length > 0 ? pockets.join(", ") : "Main";

  const text = [
    "🧚 *Pixance* is live!",
    "",
    "*Commands:*",
    "/report — monthly summary with category & pocket breakdown",
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

async function handlePockets(chatId: number, args: string[]): Promise<void> {
  const showAll = args[0]?.toLowerCase() === "all";
  const pockets = await getAllPockets();
  const list = formatPocketList(pockets, showAll);
  const header = showAll ? "*All pockets:*" : "*Active pockets:*";
  await sendMessage(chatId, `${header}\n${list}`, { parse_mode: "Markdown" });
}

// ─── /addpocket ───────────────────────────────────────────────────────────────

async function handleAddPocket(chatId: number, args: string[]): Promise<void> {
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
    const msg = err instanceof Error ? err.message : "Failed to add pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}

// ─── /renamepocket ────────────────────────────────────────────────────────────

async function handleRenamePocket(chatId: number, args: string[]): Promise<void> {
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
    const msg = err instanceof Error ? err.message : "Failed to rename pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}

// ─── /archivepocket ──────────────────────────────────────────────────────────

async function handleArchivePocket(chatId: number, args: string[]): Promise<void> {
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
    const msg = err instanceof Error ? err.message : "Failed to archive pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}

// ─── /restorepocket ──────────────────────────────────────────────────────────

async function handleRestorePocket(chatId: number, args: string[]): Promise<void> {
  const name = args[0]?.trim();
  if (!name) {
    await sendMessage(chatId, "❌ Usage: /restorepocket [name]");
    return;
  }
  try {
    await restorePocket(name);
    await sendMessage(chatId, `✅ Pocket "${name}" restored`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to restore pocket";
    await sendMessage(chatId, `❌ ${msg}`);
  }
}
