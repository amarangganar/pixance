import { beforeAll, describe, expect, test } from "bun:test";
import { loadConfig } from "../../config";
import { formatConfirmation, formatDeleteCandidates, formatDeleteConfirmation } from "../format";

const ID = "550e8400-e29b-41d4-a716-446655440000";
const TS = "2026-03-28T03:00:00.000Z"; // 10:00 WIB

beforeAll(() => loadConfig("IDR", "Asia/Jakarta"));

describe("formatConfirmation — expense", () => {
  const tx = {
    id: ID,
    timestamp: TS,
    type: "expense" as const,
    amount: 25000,
    category: "Food & Drinks" as const,
    note: "kopi",
    pocket: "Gopay",
    from_pocket: "" as const,
    to_pocket: "" as const,
  };

  test("Indonesian header for expense", () => {
    const msg = formatConfirmation(tx, "id");
    expect(msg).toContain("✅ Pengeluaran dicatat");
  });

  test("English header for expense", () => {
    const msg = formatConfirmation(tx, "en");
    expect(msg).toContain("✅ Expense recorded");
  });

  test("includes expense emoji and amount", () => {
    const msg = formatConfirmation(tx, "id");
    expect(msg).toContain("💸");
    expect(msg).toContain("25.000");
  });

  test("includes category and note", () => {
    const msg = formatConfirmation(tx, "id");
    expect(msg).toContain("Food & Drinks");
    expect(msg).toContain("kopi");
  });
});

describe("formatConfirmation — income", () => {
  const tx = {
    id: ID,
    timestamp: TS,
    type: "income" as const,
    amount: 8000000,
    category: "Salary" as const,
    note: "gajian",
    pocket: "BCA",
    from_pocket: "" as const,
    to_pocket: "" as const,
  };

  test("Indonesian header for income", () => {
    const msg = formatConfirmation(tx, "id");
    expect(msg).toContain("✅ Pemasukan dicatat");
  });

  test("English header for income", () => {
    const msg = formatConfirmation(tx, "en");
    expect(msg).toContain("✅ Income recorded");
  });

  test("includes income emoji and amount", () => {
    const msg = formatConfirmation(tx, "id");
    expect(msg).toContain("💰");
    expect(msg).toContain("8.000.000");
  });
});

describe("formatConfirmation — transfer", () => {
  const tx = {
    id: ID,
    timestamp: TS,
    type: "transfer" as const,
    amount: 3000000,
    category: "" as const,
    note: "",
    pocket: "" as const,
    from_pocket: "BCA",
    to_pocket: "Gopay",
  };

  test("Indonesian header for transfer", () => {
    const msg = formatConfirmation(tx, "id");
    expect(msg).toContain("✅ Transfer dicatat");
  });

  test("includes transfer emoji, from→to pockets", () => {
    const msg = formatConfirmation(tx, "id");
    expect(msg).toContain("🔄");
    expect(msg).toContain("BCA");
    expect(msg).toContain("Gopay");
  });
});

describe("formatDeleteConfirmation", () => {
  const expenseTx = {
    id: ID,
    timestamp: TS,
    type: "expense" as const,
    amount: 25000,
    category: "Food & Drinks" as const,
    note: "kopi",
    pocket: "Gopay",
    from_pocket: "" as const,
    to_pocket: "" as const,
  };

  test("English header for expense deletion", () => {
    const msg = formatDeleteConfirmation(expenseTx, "en");
    expect(msg).toContain("✅");
    expect(msg).toContain("deleted");
  });

  test("Indonesian header for expense deletion", () => {
    const msg = formatDeleteConfirmation(expenseTx, "id");
    expect(msg).toContain("✅");
    expect(msg).toContain("dihapus");
  });

  test("includes transaction details in confirmation", () => {
    const msg = formatDeleteConfirmation(expenseTx, "en");
    expect(msg).toContain("💸");
    expect(msg).toContain("25.000");
    expect(msg).toContain("kopi");
  });

  test("income deletion includes income emoji", () => {
    const incomeTx = {
      id: ID,
      timestamp: TS,
      type: "income" as const,
      amount: 8000000,
      category: "Salary" as const,
      note: "gajian",
      pocket: "BCA",
      from_pocket: "" as const,
      to_pocket: "" as const,
    };
    const msg = formatDeleteConfirmation(incomeTx, "en");
    expect(msg).toContain("💰");
  });

  test("transfer deletion includes transfer emoji", () => {
    const transferTx = {
      id: ID,
      timestamp: TS,
      type: "transfer" as const,
      amount: 3000000,
      category: "" as const,
      note: "",
      pocket: "" as const,
      from_pocket: "BCA",
      to_pocket: "Gopay",
    };
    const msg = formatDeleteConfirmation(transferTx, "en");
    expect(msg).toContain("🔄");
  });
});

describe("formatDeleteCandidates", () => {
  const candidates = [
    { id: "id1", summary: "💸 25rb · Food & Drinks · kopi · 28 Mar" },
    { id: "id2", summary: "💸 25rb · Food & Drinks · kopi susu · 28 Mar" },
  ];

  test("English: numbered list with cancel instruction", () => {
    const msg = formatDeleteCandidates(candidates, "en");
    expect(msg).toContain("1.");
    expect(msg).toContain("2.");
    expect(msg).toContain("cancel");
    expect(msg).toContain("kopi");
    expect(msg).toContain("kopi susu");
  });

  test("Indonesian: includes cancel instruction", () => {
    const msg = formatDeleteCandidates(candidates, "id");
    expect(msg).toContain("1.");
    expect(msg).toContain("2.");
    expect(msg).toContain("cancel");
  });
});

describe("formatConfirmation — note omission", () => {
  test("omits note separator when note is empty", () => {
    const tx = {
      id: ID,
      timestamp: TS,
      type: "expense" as const,
      amount: 10000,
      category: "Other" as const,
      note: "",
      pocket: "Main",
      from_pocket: "" as const,
      to_pocket: "" as const,
    };
    const msg = formatConfirmation(tx, "id");
    // Should not have a trailing " · " before date when note is empty
    expect(msg).not.toMatch(/·\s+·/);
  });
});
