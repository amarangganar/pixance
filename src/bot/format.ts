import type { Transaction } from "../schemas";
import { formatCurrency, formatDate, formatMonthYear } from "../utils/format";

export function formatConfirmation(tx: Transaction, lang: "id" | "en"): string {
  const amount = formatCurrency(tx.amount);
  const date = formatDate(tx.timestamp);

  if (tx.type === "transfer") {
    const header = lang === "id" ? "✅ Transfer dicatat" : "✅ Transfer recorded";
    const note = tx.note ? ` · ${tx.note}` : "";
    return `${header}\n🔄 ${amount} · ${tx.from_pocket} → ${tx.to_pocket}${note} · ${date}`;
  }

  if (tx.type === "income") {
    const header = lang === "id" ? "✅ Pemasukan dicatat" : "✅ Income recorded";
    const note = tx.note ? ` · ${tx.note}` : "";
    return `${header}\n💰 ${amount} · ${tx.category} · ${tx.pocket}${note} · ${date}`;
  }

  // expense
  const header = lang === "id" ? "✅ Pengeluaran dicatat" : "✅ Expense recorded";
  const note = tx.note ? ` · ${tx.note}` : "";
  return `${header}\n💸 ${amount} · ${tx.category} · ${tx.pocket}${note} · ${date}`;
}

// ─── Report data type ─────────────────────────────────────────────────────────

export interface ReportData {
  period: "today" | "week" | "month";
  month: number;
  year: number;
  totalIncome: number;
  totalExpense: number;
  totalTransferred: number;
  categoryBreakdown: { category: string; total: number; count: number }[];
  pocketBreakdown: { pocket: string; balance: number; overdrawn: number; used: number }[];
}

// ─── /report formatter ────────────────────────────────────────────────────────

export function formatReport(data: ReportData, lang: "id" | "en" = "en"): string {
  const { period, month, year, totalIncome, totalExpense, totalTransferred, categoryBreakdown, pocketBreakdown } = data;
  const periodLabel =
    period === "today" ? (lang === "id" ? "Hari Ini" : "Today") :
    period === "week"  ? (lang === "id" ? "Minggu Ini" : "This Week") :
    formatMonthYear(month, year, lang);
  const header = lang === "en" ? `📊 *${periodLabel} Report*` : `📊 *Laporan ${periodLabel}*`;

  const t = {
    empty: lang === "id"
      ? "Belum ada transaksi bulan ini. Yuk mulai catat keuanganmu! 💪"
      : "No transactions this month. Start logging your finances! 💪",
    income: lang === "id" ? "Pemasukan" : "Income",
    expense: lang === "id" ? "Pengeluaran" : "Expense",
    transfer: "Transfer",
    categories: lang === "id" ? "*Kategori:*" : "*Categories:*",
    perPocket: "*Per Pocket:*",
  };

  if (totalIncome === 0 && totalExpense === 0 && totalTransferred === 0) {
    return `${header}\n\n${t.empty}`;
  }

  const lines: string[] = [header, ""];

  lines.push(`💰 ${t.income}: ${formatCurrency(totalIncome)}`);
  lines.push(`💸 ${t.expense}: ${formatCurrency(totalExpense)}`);
  lines.push(`🔄 ${t.transfer}: ${formatCurrency(totalTransferred)}`);

  if (categoryBreakdown.length > 0) {
    lines.push("");
    lines.push(t.categories);
    for (const { category, total, count } of categoryBreakdown) {
      lines.push(`• ${category} — ${formatCurrency(total)} (${count}x)`);
    }
  }

  if (pocketBreakdown.length > 0) {
    lines.push("");
    lines.push(t.perPocket);
    for (const { pocket, balance, overdrawn, used } of pocketBreakdown) {
      const balanceStr = overdrawn > 0
        ? `${formatCurrency(0)} (−${formatCurrency(overdrawn)})`
        : formatCurrency(balance);
      lines.push(`• ${pocket} — balance: ${balanceStr} · used: ${formatCurrency(used)}`);
    }
  }

  return lines.join("\n");
}

// ─── Delete formatters ────────────────────────────────────────────────────────

export function formatDeleteConfirmation(tx: Transaction, lang: "id" | "en"): string {
  const amount = formatCurrency(tx.amount);
  const date = formatDate(tx.timestamp);

  if (tx.type === "transfer") {
    const header = lang === "id" ? "✅ Transfer dihapus" : "✅ Transfer deleted";
    const note = tx.note ? ` · ${tx.note}` : "";
    return `${header}\n🔄 ${amount} · ${tx.from_pocket} → ${tx.to_pocket}${note} · ${date}`;
  }

  if (tx.type === "income") {
    const header = lang === "id" ? "✅ Pemasukan dihapus" : "✅ Income deleted";
    const note = tx.note ? ` · ${tx.note}` : "";
    return `${header}\n💰 ${amount} · ${tx.category} · ${tx.pocket}${note} · ${date}`;
  }

  const header = lang === "id" ? "✅ Pengeluaran dihapus" : "✅ Expense deleted";
  const note = tx.note ? ` · ${tx.note}` : "";
  return `${header}\n💸 ${amount} · ${tx.category} · ${tx.pocket}${note} · ${date}`;
}

export function formatDeleteCandidates(
  candidates: Array<{ id: string; summary: string }>,
  lang: "id" | "en"
): string {
  const header =
    lang === "id"
      ? 'Beberapa transaksi ditemukan. Balas dengan nomor untuk menghapus, atau "cancel":'
      : 'Multiple matches found. Reply with a number to delete, or "cancel":';
  const lines = [header, ""];
  candidates.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.summary}`);
  });
  return lines.join("\n");
}

// ─── /history formatter ───────────────────────────────────────────────────────

export function formatHistory(txs: Transaction[], lang: "id" | "en" = "en"): string {
  if (txs.length === 0) {
    return lang === "id"
      ? "Belum ada transaksi. Catat transaksi pertamamu! 🌱"
      : "No transactions yet. Log your first one! 🌱";
  }

  const header = lang === "id" ? "📋 *10 Transaksi Terakhir*" : "📋 *Last 10 Transactions*";
  const lines: string[] = [header, ""];

  txs.forEach((tx, i) => {
    const n = i + 1;
    const amount = formatCurrency(tx.amount);
    const date = formatDate(tx.timestamp);

    if (tx.type === "transfer") {
      const note = tx.note ? ` · ${tx.note}` : "";
      lines.push(`${n}. 🔄 ${amount} · ${tx.from_pocket} → ${tx.to_pocket}${note} · ${date}`);
    } else if (tx.type === "income") {
      const note = tx.note ? ` · ${tx.note}` : "";
      lines.push(`${n}. 💰 ${amount} · ${tx.category} · ${tx.pocket}${note} · ${date}`);
    } else {
      const note = tx.note ? ` · ${tx.note}` : "";
      lines.push(`${n}. 💸 ${amount} · ${tx.category} · ${tx.pocket}${note} · ${date}`);
    }
  });

  return lines.join("\n");
}
