import { describe, expect, test } from "bun:test";
import { rowToTransaction, transactionToRow } from "../transactions";

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
