import { beforeAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../../config";
import type { Transaction } from "../../schemas";
import { aggregateTransactions } from "../analytics";

const ID1 = "550e8400-e29b-41d4-a716-446655440001";
const ID2 = "550e8400-e29b-41d4-a716-446655440002";
const ID3 = "550e8400-e29b-41d4-a716-446655440003";
const ID4 = "550e8400-e29b-41d4-a716-446655440004";

const TS = "2026-03-15T07:00:00.000Z";

const INCOME: Transaction = {
  id: ID1,
  timestamp: TS,
  type: "income",
  amount: 8_000_000,
  category: "Salary",
  note: "gajian",
  pocket: "BCA",
  from_pocket: "",
  to_pocket: "",
};

const EXPENSE_FOOD: Transaction = {
  id: ID2,
  timestamp: TS,
  type: "expense",
  amount: 500_000,
  category: "Food & Drinks",
  note: "makan",
  pocket: "Gopay",
  from_pocket: "",
  to_pocket: "",
};

const EXPENSE_TRANSPORT: Transaction = {
  id: ID3,
  timestamp: TS,
  type: "expense",
  amount: 100_000,
  category: "Transport",
  note: "grab",
  pocket: "Gopay",
  from_pocket: "",
  to_pocket: "",
};

const TRANSFER: Transaction = {
  id: ID4,
  timestamp: TS,
  type: "transfer",
  amount: 1_000_000,
  category: "",
  note: "topup",
  pocket: "",
  from_pocket: "BCA",
  to_pocket: "Gopay",
};

beforeAll(() => loadConfig("IDR", "Asia/Jakarta"));

describe("aggregateTransactions — totals", () => {
  const monthly = [INCOME, EXPENSE_FOOD, EXPENSE_TRANSPORT, TRANSFER];
  const ctx = aggregateTransactions(monthly, [], "en", 3, 2026, "IDR");

  test("totalIncome sums income transactions", () => {
    expect(ctx.totalIncome).toBe(8_000_000);
  });

  test("totalExpense sums expense transactions", () => {
    expect(ctx.totalExpense).toBe(600_000);
  });

  test("totalTransferred sums transfer transactions", () => {
    expect(ctx.totalTransferred).toBe(1_000_000);
  });

  test("surplus = totalIncome - totalExpense", () => {
    expect(ctx.surplus).toBe(7_400_000);
  });

  test("month and year are preserved", () => {
    expect(ctx.month).toBe(3);
    expect(ctx.year).toBe(2026);
  });

  test("currency is preserved", () => {
    expect(ctx.currency).toBe("IDR");
  });

  test("lang is preserved", () => {
    expect(ctx.lang).toBe("en");
  });

  test("monthlyTransactionCount counts all monthly transactions", () => {
    expect(ctx.monthlyTransactionCount).toBe(4);
  });
});

describe("aggregateTransactions — categoryBreakdown", () => {
  const monthly = [INCOME, EXPENSE_FOOD, EXPENSE_TRANSPORT, TRANSFER];
  const ctx = aggregateTransactions(monthly, [], "en", 3, 2026, "IDR");

  test("excludes transfers from category breakdown", () => {
    const categories = ctx.categoryBreakdown.map((c) => c.category);
    expect(categories).not.toContain("");
  });

  test("includes all income and expense categories", () => {
    const categories = ctx.categoryBreakdown.map((c) => c.category);
    expect(categories).toContain("Salary");
    expect(categories).toContain("Food & Drinks");
    expect(categories).toContain("Transport");
  });

  test("category total is correct", () => {
    const food = ctx.categoryBreakdown.find((c) => c.category === "Food & Drinks");
    expect(food?.total).toBe(500_000);
    expect(food?.count).toBe(1);
  });
});

describe("aggregateTransactions — pocketBreakdown", () => {
  const monthly = [INCOME, EXPENSE_FOOD, EXPENSE_TRANSPORT, TRANSFER];
  const ctx = aggregateTransactions(monthly, [], "en", 3, 2026, "IDR");

  test("income adds to pocket totalIn", () => {
    const bca = ctx.pocketBreakdown.find((p) => p.pocket === "BCA");
    expect(bca?.totalIn).toBe(8_000_000);
  });

  test("expense adds to pocket totalOut", () => {
    const gopay = ctx.pocketBreakdown.find((p) => p.pocket === "Gopay");
    expect(gopay?.totalOut).toBe(600_000);
  });

  test("transfer adds to from_pocket totalOut and to_pocket totalIn", () => {
    const bca = ctx.pocketBreakdown.find((p) => p.pocket === "BCA");
    const gopay = ctx.pocketBreakdown.find((p) => p.pocket === "Gopay");
    expect(bca?.totalOut).toBe(1_000_000); // transfer out
    expect(gopay?.totalIn).toBe(1_000_000); // transfer in
  });
});

describe("aggregateTransactions — recentTransactions", () => {
  const recent = [EXPENSE_FOOD, EXPENSE_TRANSPORT];

  test("recentTransactions passed through unchanged", () => {
    const ctx = aggregateTransactions([], recent, "id", 3, 2026, "IDR");
    expect(ctx.recentTransactions).toBe(recent);
  });
});

describe("aggregateTransactions — empty data", () => {
  test("all totals are zero for empty input", () => {
    const ctx = aggregateTransactions([], [], "en", 3, 2026, "IDR");
    expect(ctx.totalIncome).toBe(0);
    expect(ctx.totalExpense).toBe(0);
    expect(ctx.totalTransferred).toBe(0);
    expect(ctx.surplus).toBe(0);
    expect(ctx.monthlyTransactionCount).toBe(0);
    expect(ctx.categoryBreakdown).toHaveLength(0);
    expect(ctx.pocketBreakdown).toHaveLength(0);
  });
});

describe("aggregateTransactions — deficit", () => {
  test("surplus is negative when expenses exceed income", () => {
    const ctx = aggregateTransactions([EXPENSE_FOOD, EXPENSE_TRANSPORT], [], "en", 3, 2026, "IDR");
    expect(ctx.surplus).toBe(-600_000);
  });
});
