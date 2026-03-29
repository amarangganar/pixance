import { describe, expect, test } from "bun:test";
import { stripMarkdown, toTelegramMarkdownV2 } from "../format";

describe("toTelegramMarkdownV2 — plain text escaping", () => {
  test("escapes period", () => {
    expect(toTelegramMarkdownV2("Hello.")).toBe("Hello\\.");
  });

  test("escapes exclamation mark", () => {
    expect(toTelegramMarkdownV2("Nice!")).toBe("Nice\\!");
  });

  test("escapes hyphen", () => {
    expect(toTelegramMarkdownV2("well-done")).toBe("well\\-done");
  });

  test("escapes parentheses", () => {
    expect(toTelegramMarkdownV2("(note)")).toBe("\\(note\\)");
  });

  test("escapes plus sign", () => {
    expect(toTelegramMarkdownV2("1+1")).toBe("1\\+1");
  });

  test("does not escape plain letters and numbers", () => {
    expect(toTelegramMarkdownV2("abc 123")).toBe("abc 123");
  });

  test("does not escape newlines", () => {
    expect(toTelegramMarkdownV2("line1\nline2")).toBe("line1\nline2");
  });
});

describe("toTelegramMarkdownV2 — bold", () => {
  test("converts **bold** to *bold*", () => {
    expect(toTelegramMarkdownV2("**hello**")).toBe("*hello*");
  });

  test("escapes special chars inside bold", () => {
    expect(toTelegramMarkdownV2("**save 20%.**")).toBe("*save 20%\\.*");
  });

  test("bold with plain text around it", () => {
    expect(toTelegramMarkdownV2("before **bold** after.")).toBe("before *bold* after\\.");
  });
});

describe("toTelegramMarkdownV2 — italic", () => {
  test("keeps _italic_ as _italic_", () => {
    expect(toTelegramMarkdownV2("_italic_")).toBe("_italic_");
  });

  test("converts *italic* to _italic_", () => {
    expect(toTelegramMarkdownV2("*italic*")).toBe("_italic_");
  });

  test("escapes special chars inside italic", () => {
    expect(toTelegramMarkdownV2("_note: good._")).toBe("_note: good\\._");
  });
});

describe("toTelegramMarkdownV2 — strikethrough", () => {
  test("converts ~~strike~~ to ~strike~", () => {
    expect(toTelegramMarkdownV2("~~cut this~~")).toBe("~cut this~");
  });

  test("escapes special chars inside strikethrough", () => {
    expect(toTelegramMarkdownV2("~~Rp 500rb/month~~")).toBe("~Rp 500rb/month~");
  });
});

describe("toTelegramMarkdownV2 — code", () => {
  test("keeps inline `code` unchanged", () => {
    expect(toTelegramMarkdownV2("`code`")).toBe("`code`");
  });
});

describe("toTelegramMarkdownV2 — mixed", () => {
  test("handles multiple formatting spans in one string", () => {
    const input = "**Income**: Rp 5jt. Cut ~~eating out~~ first.";
    const result = toTelegramMarkdownV2(input);
    expect(result).toContain("*Income*");
    expect(result).toContain("~eating out~");
    expect(result).not.toContain("**");
    expect(result).not.toContain("~~");
  });

  test("bullet list lines pass through correctly", () => {
    const input = "Steps:\n• Cut food\n• Save more";
    const result = toTelegramMarkdownV2(input);
    expect(result).toContain("Steps:");
    expect(result).toContain("• Cut food");
    expect(result).toContain("• Save more");
  });

  test("empty string returns empty string", () => {
    expect(toTelegramMarkdownV2("")).toBe("");
  });
});

// ─── stripMarkdown ────────────────────────────────────────────────────────────

describe("stripMarkdown", () => {
  test("strips **bold**", () => {
    expect(stripMarkdown("**hello**")).toBe("hello");
  });

  test("strips ~~strikethrough~~", () => {
    expect(stripMarkdown("~~cut this~~")).toBe("cut this");
  });

  test("strips _italic_", () => {
    expect(stripMarkdown("_italic_")).toBe("italic");
  });

  test("strips *italic*", () => {
    expect(stripMarkdown("*italic*")).toBe("italic");
  });

  test("strips inline `code`", () => {
    expect(stripMarkdown("`code`")).toBe("code");
  });

  test("strips ```code block```", () => {
    expect(stripMarkdown("```block```")).toBe("block");
  });

  test("leaves plain text unchanged", () => {
    expect(stripMarkdown("hello world")).toBe("hello world");
  });

  test("strips multiple spans in one string", () => {
    const input = "**Income**: Rp 5jt. Cut ~~eating out~~ first.";
    const result = stripMarkdown(input);
    expect(result).toBe("Income: Rp 5jt. Cut eating out first.");
  });

  test("empty string returns empty string", () => {
    expect(stripMarkdown("")).toBe("");
  });
});
