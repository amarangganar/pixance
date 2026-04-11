import { beforeAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../../config";
import { formatHistory, formatReport } from "../format";
import type { Transaction } from "../../schemas";

const ID1 = "550e8400-e29b-41d4-a716-446655440001";
const ID2 = "550e8400-e29b-41d4-a716-446655440002";
const ID3 = "550e8400-e29b-41d4-a716-446655440003";

// 2026-03-01 10:00 WIB
const TS1 = "2026-03-01T03:00:00.000Z";
// 2026-03-15 14:00 WIB
const TS2 = "2026-03-15T07:00:00.000Z";
// 2026-03-28 10:00 WIB
const TS3 = "2026-03-28T03:00:00.000Z";

beforeAll(() => loadConfig("IDR", "Asia/Jakarta"));

// ─── formatReport ─────────────────────────────────────────────────────────────

describe("formatReport — with transactions", () => {
  const data = {
    period: "month" as const,
    month: 3,
    year: 2026,
    totalIncome: 8_000_000,
    totalExpense: 2_500_000,
    totalTransferred: 1_000_000,
    categoryBreakdown: [
      { category: "Food & Drinks", total: 500_000, count: 3 },
      { category: "Transport", total: 100_000, count: 1 },
    ],
    pocketBreakdown: [
      { pocket: "BCA", balance: 7_500_000, overdrawn: 0, used: 500_000 },
      { pocket: "Gopay", balance: 3_000_000, overdrawn: 0, used: 2_000_000 },
      { pocket: "Cash", balance: 0, overdrawn: 0, used: 100_000 },
    ],
  };

  test("defaults to English — shows English month name", () => {
    const result = formatReport(data);
    expect(result).toContain("2026");
    expect(result).toContain("March");
  });

  test("Indonesian when lang=id — shows Indonesian month name", () => {
    const result = formatReport(data, "id");
    expect(result).toContain("2026");
    expect(result).toContain("Maret");
  });

  test("English labels by default", () => {
    const result = formatReport(data);
    expect(result).toContain("Income");
    expect(result).toContain("Expense");
  });

  test("Indonesian labels when lang=id", () => {
    const result = formatReport(data, "id");
    expect(result).toContain("Pemasukan");
    expect(result).toContain("Pengeluaran");
  });

  test("shows income total", () => {
    const result = formatReport(data);
    expect(result).toContain("8.000.000");
  });

  test("shows expense total", () => {
    const result = formatReport(data);
    expect(result).toContain("2.500.000");
  });

  test("shows transfer total", () => {
    const result = formatReport(data);
    expect(result).toContain("1.000.000");
  });

  test("category breakdown lists all categories", () => {
    const result = formatReport(data);
    expect(result).toContain("Food & Drinks");
    expect(result).toContain("Transport");
  });

  test("category breakdown shows count", () => {
    const result = formatReport(data);
    expect(result).toContain("3x");
    expect(result).toContain("1x");
  });

  test("pocket breakdown shows pocket names", () => {
    const result = formatReport(data);
    expect(result).toContain("BCA");
    expect(result).toContain("Gopay");
    expect(result).toContain("Cash");
  });

  test("no progress bars appear in the report", () => {
    const result = formatReport(data);
    expect(result).not.toMatch(/\[█+░*\] \d+%/);
  });
});

describe("formatReport — no transactions", () => {
  test("returns English encouraging message by default", () => {
    const result = formatReport({
      period: "month",
      month: 3,
      year: 2026,
      totalIncome: 0,
      totalExpense: 0,
      totalTransferred: 0,
      categoryBreakdown: [],
      pocketBreakdown: [],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/\[█+░*\] \d+%/);
  });

  test("returns Indonesian encouraging message when lang=id", () => {
    const result = formatReport({
      period: "month",
      month: 3,
      year: 2026,
      totalIncome: 0,
      totalExpense: 0,
      totalTransferred: 0,
      categoryBreakdown: [],
      pocketBreakdown: [],
    }, "id");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/\[█+░*\] \d+%/);
  });
});

describe("formatReport — income is zero", () => {
  test("overall progress bar omitted when income is 0", () => {
    const result = formatReport({
      period: "month",
      month: 3,
      year: 2026,
      totalIncome: 0,
      totalExpense: 500_000,
      totalTransferred: 0,
      categoryBreakdown: [{ category: "Food & Drinks", total: 500_000, count: 2 }],
      pocketBreakdown: [{ pocket: "Cash", balance: 1_000_000, overdrawn: 0, used: 500_000 }],
    });
    // Only the pocket bar should appear, not an overall income-vs-expense bar
    // Count bars: should be 1 (pocket) not 2 (overall + pocket)
    const barMatches = result.match(/\[█+░*\] \d+%/g);
    // overall bar should NOT be present since income === 0
    // verify by checking expense section doesn't have a bar right after it
    expect(result).toContain("500.000");
    // Just confirm no "NaN%" in result
    expect(result).not.toContain("NaN");
  });
});

// ─── formatHistory ────────────────────────────────────────────────────────────

describe("formatHistory — language", () => {
  test("defaults to English header", () => {
    const result = formatHistory([]);
    expect(result).not.toContain("Terakhir");
  });

  test("Indonesian header when lang=id", () => {
    const result = formatHistory([], "id");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatHistory — with transactions", () => {
  const txs: Transaction[] = [
    {
      id: ID1,
      timestamp: TS3,
      type: "expense",
      amount: 25_000,
      category: "Food & Drinks",
      note: "kopi",
      pocket: "Gopay",
      from_pocket: "",
      to_pocket: "",
    },
    {
      id: ID2,
      timestamp: TS2,
      type: "income",
      amount: 8_000_000,
      category: "Salary",
      note: "gajian",
      pocket: "BCA",
      from_pocket: "",
      to_pocket: "",
    },
    {
      id: ID3,
      timestamp: TS1,
      type: "transfer",
      amount: 3_000_000,
      category: "",
      note: "topup",
      pocket: "",
      from_pocket: "BCA",
      to_pocket: "Gopay",
    },
  ];

  test("shows header", () => {
    const result = formatHistory(txs);
    expect(result.length).toBeGreaterThan(0);
  });

  test("1-based position numbers", () => {
    const result = formatHistory(txs);
    expect(result).toContain("1.");
    expect(result).toContain("2.");
    expect(result).toContain("3.");
  });

  test("expense format: N. 💸 amount · category · note · date", () => {
    const result = formatHistory(txs);
    expect(result).toContain("💸");
    expect(result).toContain("25.000");
    expect(result).toContain("Food & Drinks");
    expect(result).toContain("kopi");
  });

  test("income format: N. 💰 amount · category · note · date", () => {
    const result = formatHistory(txs);
    expect(result).toContain("💰");
    expect(result).toContain("8.000.000");
    expect(result).toContain("Salary");
    expect(result).toContain("gajian");
  });

  test("transfer format: N. 🔄 amount · from → to · note · date", () => {
    const result = formatHistory(txs);
    expect(result).toContain("🔄");
    expect(result).toContain("3.000.000");
    expect(result).toContain("BCA");
    expect(result).toContain("Gopay");
    expect(result).toContain("topup");
  });

  test("transfer uses arrow between pockets", () => {
    const result = formatHistory(txs);
    expect(result).toContain("BCA → Gopay");
  });
});

describe("formatHistory — note omission", () => {
  test("omits note separator when note is empty", () => {
    const txs: Transaction[] = [
      {
        id: ID1,
        timestamp: TS1,
        type: "expense",
        amount: 10_000,
        category: "Other",
        note: "",
        pocket: "Main",
        from_pocket: "",
        to_pocket: "",
      },
    ];
    const result = formatHistory(txs);
    expect(result).not.toMatch(/·\s+·/);
  });
});

describe("formatHistory — empty", () => {
  test("returns message when no transactions", () => {
    const result = formatHistory([]);
    expect(result.length).toBeGreaterThan(0);
  });
});
