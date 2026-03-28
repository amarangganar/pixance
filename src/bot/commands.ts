import type { Pocket } from "../schemas";
import {
  addPocket,
  archivePocket,
  getAllPockets,
  getActivePocketNames,
  renamePocket,
  restorePocket,
} from "../sheets/pockets";
import { sendMessage } from "./telegram";

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
