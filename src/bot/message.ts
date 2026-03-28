import { detectLanguage } from "../ai/advisor";
import { parseMessage } from "../ai/parser";
import { buildAndSaveTransaction } from "../services/transaction";
import { getActivePocketNames } from "../sheets/pockets";
import { deleteMessage, sendMessage } from "./telegram";
import { formatConfirmation } from "./format";

// ─── Pending disambiguation state ────────────────────────────────────────────
// Used in Phase 6 for delete disambiguation.

export interface PendingDelete {
  candidates: Array<{ id: string; summary: string }>;
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleMessage(chatId: number, text: string): Promise<void> {
  const lang = detectLanguage(text);

  // Phase 6: pending delete disambiguation — placeholder, not yet implemented.
  if (pendingDeletes.has(chatId)) {
    pendingDeletes.delete(chatId);
  }

  const placeholderText = lang === "id" ? "Menganalisis..." : "Analyzing...";
  const { message_id: placeholderId } = await sendMessage(chatId, placeholderText, {});

  try {
    const activePockets = await getActivePocketNames();
    const parsed = await parseMessage(text, activePockets);

    await deleteMessage(chatId, placeholderId);

    if (!TRANSACTION_INTENTS.has(parsed.intent) || parsed.confidence < 0.5 || !parsed.amount) {
      await sendMessage(chatId, lang === "id" ? HELP_ID : HELP_EN, { parse_mode: "Markdown" });
      return;
    }

    const tx = await buildAndSaveTransaction(parsed, activePockets);
    await sendMessage(chatId, formatConfirmation(tx, lang), { parse_mode: "Markdown" });
  } catch {
    // Try to clean up placeholder; ignore if already deleted.
    await deleteMessage(chatId, placeholderId).catch(() => {});
    // Append failure → no success confirmation.
    const errMsg =
      lang === "id"
        ? "❌ Gagal memproses pesan. Coba lagi."
        : "❌ Failed to process message. Please try again.";
    await sendMessage(chatId, errMsg, {});
  }
}
