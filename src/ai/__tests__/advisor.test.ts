import { describe, expect, mock, test } from "bun:test";
import { detectLanguage } from "../advisor";

describe("detectLanguage", () => {
  test("detects Indonesian from rb shorthand", () => {
    expect(detectLanguage("kopi 25rb")).toBe("id");
  });

  test("detects Indonesian from jt shorthand", () => {
    expect(detectLanguage("gajian 8jt")).toBe("id");
  });

  test("detects Indonesian from common words", () => {
    expect(detectLanguage("makan siang pake gopay")).toBe("id");
    expect(detectLanguage("bayar listrik bulan ini")).toBe("id");
    expect(detectLanguage("transfer dari BCA ke Gopay")).toBe("id");
    expect(detectLanguage("gimana kondisi keuangan aku")).toBe("id");
    expect(detectLanguage("hapus transaksi tadi")).toBe("id");
  });

  test("detects English from English-only text", () => {
    expect(detectLanguage("how is my spending this month")).toBe("en");
    expect(detectLanguage("show me recent transactions")).toBe("en");
  });

  test("defaults to id for empty string", () => {
    expect(detectLanguage("")).toBe("id");
  });

  test("defaults to id for numbers only", () => {
    expect(detectLanguage("25000")).toBe("id");
  });

  test("defaults to id for punctuation only", () => {
    expect(detectLanguage("!!!")).toBe("id");
  });
});

// ─── getAdvice / getQuickSummary — AI failure fallback ────────────────────────

mock.module("ai", () => ({
  generateText: mock(async () => {
    throw new Error("AI service unavailable");
  }),
  gateway: mock(() => "mock-model"),
}));

const { getAdvice, getQuickSummary } = await import("../advisor");

const SPARSE_CTX = {
  currency: "IDR",
  lang: "en" as const,
  month: 3,
  year: 2026,
  totalIncome: 0,
  totalExpense: 0,
  totalTransferred: 0,
  surplus: 0,
  monthlyTransactionCount: 0,
  categoryBreakdown: [],
  pocketBreakdown: [],
  recentTransactions: [],
};

describe("getAdvice — AI failure fallback", () => {
  test("returns non-empty string in English when AI throws", async () => {
    const result = await getAdvice("how is my spending?", { ...SPARSE_CTX, lang: "en" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns non-empty string in Indonesian when AI throws", async () => {
    const result = await getAdvice("gimana kondisi keuangan aku?", { ...SPARSE_CTX, lang: "id" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("does not throw even when AI fails", async () => {
    await expect(getAdvice("test", SPARSE_CTX)).resolves.toBeDefined();
  });
});

describe("getQuickSummary — AI failure fallback", () => {
  test("returns non-empty string in English when AI throws", async () => {
    const result = await getQuickSummary({ ...SPARSE_CTX, lang: "en" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns non-empty string in Indonesian when AI throws", async () => {
    const result = await getQuickSummary({ ...SPARSE_CTX, lang: "id" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("does not throw even when AI fails", async () => {
    await expect(getQuickSummary(SPARSE_CTX)).resolves.toBeDefined();
  });
});
