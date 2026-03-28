import type { Transaction } from "../schemas";
import { formatCurrency, formatDate } from "../utils/format";

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
    return `${header}\n💰 ${amount} · ${tx.category}${note} · ${date}`;
  }

  // expense
  const header = lang === "id" ? "✅ Pengeluaran dicatat" : "✅ Expense recorded";
  const note = tx.note ? ` · ${tx.note}` : "";
  return `${header}\n💸 ${amount} · ${tx.category}${note} · ${date}`;
}
