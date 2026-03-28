import { describe, expect, test } from "bun:test";
import type { Pocket } from "../../schemas";
import { formatPocketList, parseArgs } from "../commands";

// ─── parseArgs ────────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  test("splits simple whitespace-separated args", () => {
    expect(parseArgs("BCA Gopay")).toEqual(["BCA", "Gopay"]);
  });

  test("handles quoted arg with spaces", () => {
    expect(parseArgs('BCA "BCA Syariah"')).toEqual(["BCA", "BCA Syariah"]);
  });

  test("handles single-quoted arg with spaces", () => {
    expect(parseArgs("BCA 'BCA Syariah'")).toEqual(["BCA", "BCA Syariah"]);
  });

  test("handles single unquoted arg", () => {
    expect(parseArgs("OVO")).toEqual(["OVO"]);
  });

  test("returns empty array for empty string", () => {
    expect(parseArgs("")).toEqual([]);
  });

  test("trims surrounding whitespace", () => {
    expect(parseArgs("  BCA  ")).toEqual(["BCA"]);
  });
});

// ─── formatPocketList ─────────────────────────────────────────────────────────

describe("formatPocketList — active only", () => {
  const pockets: Pocket[] = [
    { name: "BCA", status: "active" },
    { name: "Gopay", status: "active" },
  ];

  test("lists active pockets", () => {
    const result = formatPocketList(pockets, false);
    expect(result).toContain("BCA");
    expect(result).toContain("Gopay");
  });

  test("does not show archived label when showAll is false", () => {
    const result = formatPocketList(pockets, false);
    expect(result).not.toContain("[archived]");
  });
});

describe("formatPocketList — all pockets", () => {
  const pockets: Pocket[] = [
    { name: "BCA", status: "active" },
    { name: "Cash", status: "archived" },
  ];

  test("lists all pockets", () => {
    const result = formatPocketList(pockets, true);
    expect(result).toContain("BCA");
    expect(result).toContain("Cash");
  });

  test("labels archived pockets", () => {
    const result = formatPocketList(pockets, true);
    expect(result).toContain("Cash [archived]");
  });

  test("does not label active pockets", () => {
    const result = formatPocketList(pockets, true);
    expect(result).not.toContain("BCA [archived]");
  });
});

describe("formatPocketList — empty", () => {
  test("returns a non-empty string when no pockets", () => {
    const result = formatPocketList([], false);
    expect(result.length).toBeGreaterThan(0);
  });
});
