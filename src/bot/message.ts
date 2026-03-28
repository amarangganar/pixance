import { detectLanguage } from "../ai/advisor";
import { sendMessage } from "./telegram";

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

// ─── Handler ──────────────────────────────────────────────────────────────────
// Phase 1: returns a contextual help message.
// Phase 2+: routes to parser → record/query/delete flows.

export async function handleMessage(chatId: number, text: string): Promise<void> {
  const lang = detectLanguage(text);
  await sendMessage(chatId, lang === "id" ? HELP_ID : HELP_EN, { parse_mode: "Markdown" });
}
