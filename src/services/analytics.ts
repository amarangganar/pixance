import { getCurrency } from "../config";
import type { Transaction } from "../schemas";
import { getMonthlyTransactions, getRecentTransactions } from "../sheets/transactions";

// ─── FinancialContext ─────────────────────────────────────────────────────────
// Assembled in-process from validated Sheets data. Not a Zod schema.

export interface FinancialContext {
  currency: string;
  lang: "id" | "en";
  month: number;
  year: number;
  totalIncome: number;
  totalExpense: number;
  totalTransferred: number;
  surplus: number; // totalIncome - totalExpense
  monthlyTransactionCount: number;
  categoryBreakdown: { category: string; total: number; count: number }[];
  pocketBreakdown: {
    pocket: string;
    totalIn: number; // income received + transfers in
    totalOut: number; // expenses paid + transfers out
  }[];
  recentTransactions: Transaction[];
}

// ─── Pure aggregation (exported for testing) ─────────────────────────────────

export function aggregateTransactions(
  monthly: Transaction[],
  recent: Transaction[],
  lang: "id" | "en",
  month: number,
  year: number,
  currency: string
): FinancialContext {
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransferred = 0;

  const catMap = new Map<string, { total: number; count: number }>();
  const pocketMap = new Map<string, { totalIn: number; totalOut: number }>();

  const pocket = (name: string) => {
    if (!pocketMap.has(name)) pocketMap.set(name, { totalIn: 0, totalOut: 0 });
    return pocketMap.get(name)!;
  };

  for (const tx of monthly) {
    if (tx.type === "income") {
      totalIncome += tx.amount;
      const cat = catMap.get(tx.category) ?? { total: 0, count: 0 };
      cat.total += tx.amount;
      cat.count += 1;
      catMap.set(tx.category, cat);
      pocket(tx.pocket).totalIn += tx.amount;
    } else if (tx.type === "expense") {
      totalExpense += tx.amount;
      const cat = catMap.get(tx.category) ?? { total: 0, count: 0 };
      cat.total += tx.amount;
      cat.count += 1;
      catMap.set(tx.category, cat);
      pocket(tx.pocket).totalOut += tx.amount;
    } else {
      totalTransferred += tx.amount;
      pocket(tx.from_pocket).totalOut += tx.amount;
      pocket(tx.to_pocket).totalIn += tx.amount;
    }
  }

  return {
    currency,
    lang,
    month,
    year,
    totalIncome,
    totalExpense,
    totalTransferred,
    surplus: totalIncome - totalExpense,
    monthlyTransactionCount: monthly.length,
    categoryBreakdown: [...catMap.entries()].map(([category, { total, count }]) => ({
      category,
      total,
      count,
    })),
    pocketBreakdown: [...pocketMap.entries()].map(([p, { totalIn, totalOut }]) => ({
      pocket: p,
      totalIn,
      totalOut,
    })),
    recentTransactions: recent,
  };
}

// ─── buildFinancialContext ────────────────────────────────────────────────────

export async function buildFinancialContext(
  lang: "id" | "en",
  month: number,
  year: number
): Promise<FinancialContext> {
  const [monthly, recent] = await Promise.all([
    getMonthlyTransactions(month, year),
    getRecentTransactions(10),
  ]);
  return aggregateTransactions(monthly, recent, lang, month, year, getCurrency());
}
