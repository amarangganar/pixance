import type { Transaction } from "../schemas";

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
  categoryBreakdown: { category: string; total: number; count: number }[];
  pocketBreakdown: {
    pocket: string;
    totalIn: number; // income received + transfers in
    totalOut: number; // expenses paid + transfers out
  }[];
  recentTransactions: Transaction[];
}

// Implemented in Phase 5.
export async function buildFinancialContext(
  _lang: "id" | "en",
  _month: number,
  _year: number
): Promise<FinancialContext> {
  throw new Error("Not implemented — Phase 5");
}
