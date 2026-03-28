import type { Transaction } from "../schemas";

// Implemented in Phase 2.

export async function appendTransaction(_tx: Omit<Transaction, "id">): Promise<Transaction> {
  throw new Error("Not implemented — Phase 2");
}

export async function getAllTransactions(): Promise<Transaction[]> {
  throw new Error("Not implemented — Phase 2");
}

export async function getMonthlyTransactions(
  _month: number,
  _year: number
): Promise<Transaction[]> {
  throw new Error("Not implemented — Phase 2");
}

export async function getMonthlySummary(
  _month: number,
  _year: number
): Promise<{ totalIncome: number; totalExpense: number; totalTransferred: number }> {
  throw new Error("Not implemented — Phase 2");
}

export async function getCategoryBreakdown(
  _month: number,
  _year: number
): Promise<{ category: string; total: number; count: number }[]> {
  throw new Error("Not implemented — Phase 2");
}

export async function getPocketBreakdown(
  _month: number,
  _year: number
): Promise<{ pocket: string; totalIn: number; totalOut: number }[]> {
  throw new Error("Not implemented — Phase 2");
}

export async function getRecentTransactions(_limit: number): Promise<Transaction[]> {
  throw new Error("Not implemented — Phase 2");
}

export async function deleteTransaction(_id: string): Promise<boolean> {
  throw new Error("Not implemented — Phase 6");
}
