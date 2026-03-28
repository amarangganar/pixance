import { getActivePocketNames } from "../sheets/pockets";
import { sendMessage } from "./telegram";

// ─── Command router ───────────────────────────────────────────────────────────

export async function handleCommand(chatId: number, text: string): Promise<void> {
  // Extract base command (e.g. "/pockets all" → "/pockets", args = ["all"])
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case "/start":
      return handleStart(chatId);
    default:
      await sendMessage(chatId, "Unknown command. Use /start to see available commands.");
  }

  // Suppress unused variable warning for future phases
  void args;
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
