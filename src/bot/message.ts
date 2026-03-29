import { detectLanguage, getAdvice } from "../ai/advisor";
import { parseMessage } from "../ai/parser";
import { buildFinancialContext } from "../services/analytics";
import { buildAndSaveTransaction } from "../services/transaction";
import { getActivePocketNames } from "../sheets/pockets";
import { deleteTransaction, findMatchingTransactions, getLastNDaysTransactions } from "../sheets/transactions";
import { getCurrentMonthYear, formatCurrency, formatDate, toTelegramMarkdownV2, stripMarkdown } from "../utils/format";
import { deleteMessage, sendMessage } from "./telegram";
import { formatConfirmation, formatDeleteCandidates, formatDeleteConfirmation } from "./format";

// ─── Pending disambiguation state ────────────────────────────────────────────

export interface PendingDelete {
  candidates: Array<{ id: string; summary: string }>;
  lang: "id" | "en";
}

export const pendingDeletes = new Map<number, PendingDelete>();

// ─── Help text ────────────────────────────────────────────────────────────────

const HELP_ID = `Ketik transaksi kamu dalam bahasa natural, contoh:
\`kopi 25rb pake gopay\`
\`gajian 8jt ke BCA\`
\`transfer BCA ke Gopay 1jt\`
\`hapus kopi 25rb tadi\`

Atau tanya soal keuangan kamu:
\`gimana kondisi keuangan aku bulan ini?\`

Gunakan /start untuk melihat semua perintah.`;

const HELP_EN = `Type your transactions in natural language, e.g.:
\`kopi 25rb pake gopay\`
\`gajian 8jt ke BCA\`
\`transfer BCA ke Gopay 1jt\`
\`hapus kopi 25rb tadi\`

Or ask about your finances:
\`how's my spending this month?\`

Use /start to see all available commands.`;

const TRANSACTION_INTENTS = new Set(["income", "expense", "transfer"]);

// ─── Transaction summary line (for disambiguation list) ───────────────────────

function summarizeTx(tx: import("../schemas").Transaction): string {
  const amount = formatCurrency(tx.amount);
  const date = formatDate(tx.timestamp);
  if (tx.type === "transfer") {
    const note = tx.note ? ` · ${tx.note}` : "";
    return `🔄 ${amount} · ${tx.from_pocket} → ${tx.to_pocket}${note} · ${date}`;
  }
  const emoji = tx.type === "income" ? "💰" : "💸";
  const note = tx.note ? ` · ${tx.note}` : "";
  return `${emoji} ${amount} · ${tx.category}${note} · ${date}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleMessage(chatId: number, text: string): Promise<void> {
  const lang = detectLanguage(text);

  // Pending delete disambiguation
  const pending = pendingDeletes.get(chatId);
  if (pending) {
    const reply = text.trim().toLowerCase();
    if (reply === "cancel" || reply === "batal") {
      pendingDeletes.delete(chatId);
      const msg = pending.lang === "id" ? "✅ Penghapusan dibatalkan." : "✅ Delete cancelled.";
      await sendMessage(chatId, msg, {});
      return;
    }
    const n = parseInt(reply, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= pending.candidates.length) {
      pendingDeletes.delete(chatId);
      const candidate = pending.candidates[n - 1];
      try {
        await deleteTransaction(candidate.id);
        const msg =
          pending.lang === "id"
            ? `✅ Transaksi dihapus:\n${candidate.summary}`
            : `✅ Transaction deleted:\n${candidate.summary}`;
        await sendMessage(chatId, msg, {});
      } catch {
        const errMsg =
          pending.lang === "id"
            ? "❌ Gagal menghapus transaksi. Coba lagi."
            : "❌ Failed to delete transaction. Please try again.";
        await sendMessage(chatId, errMsg, {});
      }
      return;
    }
    // Any other reply — re-send the candidates list
    await sendMessage(chatId, formatDeleteCandidates(pending.candidates, pending.lang), {});
    return;
  }

  const placeholderText = lang === "id" ? "Menganalisis..." : "Analyzing...";
  const { message_id: placeholderId } = await sendMessage(chatId, placeholderText, {});

  try {
    const activePockets = await getActivePocketNames();
    const parsed = await parseMessage(text, activePockets);

    await deleteMessage(chatId, placeholderId);

    if (parsed.intent === "delete") {
      if (!parsed.amount && !parsed.note) {
        const msg =
          lang === "id"
            ? "❌ Tidak dapat menemukan detail transaksi yang ingin dihapus."
            : "❌ Could not identify which transaction to delete.";
        await sendMessage(chatId, msg, {});
        return;
      }
      const recentTxs = await getLastNDaysTransactions(7);
      const matches = findMatchingTransactions(recentTxs, parsed.amount ?? undefined, parsed.note ?? undefined);
      if (matches.length === 0) {
        const msg =
          lang === "id"
            ? "❌ Tidak ada transaksi yang sesuai dalam 7 hari terakhir."
            : "❌ No matching transaction found in the last 7 days.";
        await sendMessage(chatId, msg, {});
        return;
      }
      if (matches.length === 1) {
        await deleteTransaction(matches[0].id);
        await sendMessage(chatId, formatDeleteConfirmation(matches[0], lang), { parse_mode: "Markdown" });
        return;
      }
      // 2+ matches — store and ask for disambiguation
      const candidates = matches.map((tx) => ({ id: tx.id, summary: summarizeTx(tx) }));
      pendingDeletes.set(chatId, { candidates, lang });
      await sendMessage(chatId, formatDeleteCandidates(candidates, lang), {});
      return;
    }

    if (parsed.intent === "query" || parsed.intent === "advice") {
      const { month, year } = getCurrentMonthYear();
      const ctx = await buildFinancialContext(lang, month, year);
      const advice = await getAdvice(text, ctx);
      try {
        await sendMessage(chatId, toTelegramMarkdownV2(advice), { parse_mode: "MarkdownV2" });
      } catch {
        await sendMessage(chatId, stripMarkdown(advice));
      }
      return;
    }

    if (!TRANSACTION_INTENTS.has(parsed.intent) || parsed.confidence < 0.5 || !parsed.amount) {
      await sendMessage(chatId, lang === "id" ? HELP_ID : HELP_EN, { parse_mode: "Markdown" });
      return;
    }

    const tx = await buildAndSaveTransaction(parsed, activePockets);
    await sendMessage(chatId, formatConfirmation(tx, lang), { parse_mode: "Markdown" });
  } catch {
    // Try to clean up placeholder; ignore if already deleted.
    await deleteMessage(chatId, placeholderId).catch(() => {});
    const errMsg =
      lang === "id"
        ? "❌ Gagal memproses pesan. Coba lagi."
        : "❌ Failed to process message. Please try again.";
    await sendMessage(chatId, errMsg, {});
  }
}
