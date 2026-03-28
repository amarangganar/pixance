import { describe, expect, test } from "bun:test";
import type { Transaction } from "../../schemas";
import { findMatchingTransactions, rowToTransaction, transactionToRow } from "../transactions";

const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_TS = "2026-03-28T10:00:00.000Z";

describe("rowToTransaction", () => {
  test("parses a valid expense row", () => {
    const row = [VALID_ID, VALID_TS, "expense", "25000", "Food & Drinks", "kopi", "Gopay", "", ""];
    const tx = rowToTransaction(row);
    expect(tx).not.toBeNull();
    expect(tx?.type).toBe("expense");
    expect(tx?.amount).toBe(25000);
    expect(tx?.category).toBe("Food & Drinks");
    expect(tx?.note).toBe("kopi");
    expect(tx?.pocket).toBe("Gopay");
  });

  test("parses a valid income row", () => {
    const row = [VALID_ID, VALID_TS, "income", "8000000", "Salary", "gajian", "BCA", "", ""];
    const tx = rowToTransaction(row);
    expect(tx?.type).toBe("income");
    expect(tx?.amount).toBe(8000000);
    expect(tx?.pocket).toBe("BCA");
  });

  test("parses a valid transfer row", () => {
    const row = [VALID_ID, VALID_TS, "transfer", "3000000", "", "", "", "BCA", "Gopay"];
    const tx = rowToTransaction(row);
    expect(tx?.type).toBe("transfer");
    expect(tx?.amount).toBe(3000000);
    expect(tx?.from_pocket).toBe("BCA");
    expect(tx?.to_pocket).toBe("Gopay");
  });

  test("returns null for invalid UUID", () => {
    const row = ["not-a-uuid", VALID_TS, "expense", "25000", "Food & Drinks", "", "Main", "", ""];
    expect(rowToTransaction(row)).toBeNull();
  });

  test("returns null for negative amount", () => {
    const row = [VALID_ID, VALID_TS, "expense", "-100", "Food & Drinks", "", "Main", "", ""];
    expect(rowToTransaction(row)).toBeNull();
  });

  test("returns null for unknown transaction type", () => {
    const row = [VALID_ID, VALID_TS, "refund", "1000", "Other", "", "Main", "", ""];
    expect(rowToTransaction(row)).toBeNull();
  });

  test("returns null for missing required transfer pockets", () => {
    const row = [VALID_ID, VALID_TS, "transfer", "1000", "", "", "", "", ""];
    expect(rowToTransaction(row)).toBeNull();
  });

  test("returns null for NaN amount", () => {
    const row = [VALID_ID, VALID_TS, "expense", "abc", "Food & Drinks", "", "Main", "", ""];
    expect(rowToTransaction(row)).toBeNull();
  });
});

describe("rowToTransaction — numeric values from UNFORMATTED_VALUE", () => {
  test("handles numeric amount (what Sheets UNFORMATTED_VALUE returns)", () => {
    const row = [VALID_ID, VALID_TS, "expense", 25000, "Food & Drinks", "kopi", "Gopay", "", ""];
    const tx = rowToTransaction(row);
    expect(tx?.amount).toBe(25000);
  });

  test("handles 25000 not 25 when amount is the number 25000", () => {
    const row = [VALID_ID, VALID_TS, "income", 8000000, "Salary", "gajian", "BCA", "", ""];
    const tx = rowToTransaction(row);
    expect(tx?.amount).toBe(8000000);
  });
});

describe("transactionToRow", () => {
  test("serializes expense transaction", () => {
    const tx = {
      id: VALID_ID,
      timestamp: VALID_TS,
      type: "expense" as const,
      amount: 25000,
      category: "Food & Drinks" as const,
      note: "kopi",
      pocket: "Gopay",
      from_pocket: "" as const,
      to_pocket: "" as const,
    };
    const row = transactionToRow(tx);
    expect(row).toEqual([VALID_ID, VALID_TS, "expense", "25000", "Food & Drinks", "kopi", "Gopay", "", ""]);
  });

  test("serializes transfer transaction", () => {
    const tx = {
      id: VALID_ID,
      timestamp: VALID_TS,
      type: "transfer" as const,
      amount: 3000000,
      category: "" as const,
      note: "",
      pocket: "" as const,
      from_pocket: "BCA",
      to_pocket: "Gopay",
    };
    const row = transactionToRow(tx);
    expect(row).toEqual([VALID_ID, VALID_TS, "transfer", "3000000", "", "", "", "BCA", "Gopay"]);
  });

  test("round-trips an expense row", () => {
    const original = [VALID_ID, VALID_TS, "expense", "25000", "Food & Drinks", "kopi", "Gopay", "", ""];
    const tx = rowToTransaction(original);
    expect(tx).not.toBeNull();
    expect(transactionToRow(tx!)).toEqual(original);
  });

  test("round-trips a transfer row", () => {
    const original = [VALID_ID, VALID_TS, "transfer", "3000000", "", "", "", "BCA", "Gopay"];
    const tx = rowToTransaction(original);
    expect(tx).not.toBeNull();
    expect(transactionToRow(tx!)).toEqual(original);
  });
});

// ─── findMatchingTransactions ─────────────────────────────────────────────────

const VALID_ID_2 = "660e8400-e29b-41d4-a716-446655440001";
const VALID_ID_3 = "770e8400-e29b-41d4-a716-446655440002";

const SAMPLE_TXS: Transaction[] = [
  {
    id: VALID_ID,
    timestamp: VALID_TS,
    type: "expense",
    amount: 25000,
    category: "Food & Drinks",
    note: "kopi",
    pocket: "Gopay",
    from_pocket: "",
    to_pocket: "",
  },
  {
    id: VALID_ID_2,
    timestamp: VALID_TS,
    type: "expense",
    amount: 25000,
    category: "Food & Drinks",
    note: "Kopi Susu",
    pocket: "Gopay",
    from_pocket: "",
    to_pocket: "",
  },
  {
    id: VALID_ID_3,
    timestamp: VALID_TS,
    type: "income",
    amount: 8000000,
    category: "Salary",
    note: "gajian",
    pocket: "BCA",
    from_pocket: "",
    to_pocket: "",
  },
];

describe("findMatchingTransactions", () => {
  test("matches by amount and note (both present, note is exact match)", () => {
    // "susu" only matches "Kopi Susu", not "kopi"
    const result = findMatchingTransactions(SAMPLE_TXS, 25000, "susu");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(VALID_ID_2);
  });

  test("returns multiple when multiple match by amount only", () => {
    const result = findMatchingTransactions(SAMPLE_TXS, 25000, undefined);
    expect(result).toHaveLength(2);
  });

  test("matches by note only when amount is undefined", () => {
    const result = findMatchingTransactions(SAMPLE_TXS, undefined, "gajian");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(VALID_ID_3);
  });

  test("note match is case-insensitive", () => {
    const result = findMatchingTransactions(SAMPLE_TXS, undefined, "KOPI");
    expect(result).toHaveLength(2);
  });

  test("note match is substring", () => {
    const result = findMatchingTransactions(SAMPLE_TXS, undefined, "susu");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(VALID_ID_2);
  });

  test("returns empty when no match", () => {
    const result = findMatchingTransactions(SAMPLE_TXS, 99999, "xyz");
    expect(result).toHaveLength(0);
  });

  test("returns empty when both amount and note are undefined", () => {
    const result = findMatchingTransactions(SAMPLE_TXS, undefined, undefined);
    expect(result).toHaveLength(0);
  });
});
