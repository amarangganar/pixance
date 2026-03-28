import { describe, expect, test } from "bun:test";
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
