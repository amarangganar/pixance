import { getCurrency, getTimezone } from "../config";

// ─── Currency formatting ──────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency ?? getCurrency();

  if (cur === "IDR") {
    return "Rp" + new Intl.NumberFormat("id-ID").format(amount);
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amount);
}

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: getTimezone(),
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoString));
}

export function formatMonthYear(month: number, year: number, lang: "id" | "en" = "id"): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

// Returns the current month and year in the configured timezone.
export function getCurrentMonthYear(): { month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: getTimezone(),
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date());

  return {
    month: parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10),
    year: parseInt(parts.find((p) => p.type === "year")?.value ?? "2000", 10),
  };
}

// Returns true if the UTC ISO timestamp falls within the given month/year
// when viewed in the configured timezone.
export function isInMonth(isoString: string, month: number, year: number): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: getTimezone(),
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(isoString));

  const txMonth = parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10);
  const txYear = parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
  return txMonth === month && txYear === year;
}

export function isToday(isoString: string): boolean {
  const tz = getTimezone();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  return fmt.format(new Date()) === fmt.format(new Date(isoString));
}

export function isInWeek(isoString: string): boolean {
  const tz = getTimezone();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
  const nowDate = new Date(fmt.format(new Date()));
  const txDate = new Date(fmt.format(new Date(isoString)));
  const diffDays = (nowDate.getTime() - txDate.getTime()) / 86_400_000;
  return diffDays >= 0 && diffDays < 7;
}

// ─── Telegram MarkdownV2 converter ───────────────────────────────────────────
// Converts standard Markdown (as produced by AI models) to Telegram MarkdownV2.
// - **bold** → *bold*
// - _italic_ / *italic* → _italic_
// - ~~strikethrough~~ → ~strikethrough~
// - `code` / ```blocks``` → unchanged
// - All MarkdownV2 special characters in plain text are backslash-escaped.

const MDV2_SPECIAL = /([_*[\]()~`>#+\-=|{}.!\\])/g;

function escapeV2(s: string): string {
  return s.replace(MDV2_SPECIAL, "\\$1");
}

const MDV2_FORMAT =
  /(\*\*[\s\S]+?\*\*|~~[\s\S]+?~~|```[\s\S]+?```|`[^`\n]+`|_[^_\n]+?_|\*[^*\n]+?\*)/g;

export function toTelegramMarkdownV2(text: string): string {
  const result: string[] = [];
  let lastIndex = 0;

  MDV2_FORMAT.lastIndex = 0;
  for (const match of text.matchAll(MDV2_FORMAT)) {
    result.push(escapeV2(text.slice(lastIndex, match.index)));

    const span = match[0];
    if (span.startsWith("**")) {
      result.push(`*${escapeV2(span.slice(2, -2))}*`);
    } else if (span.startsWith("~~")) {
      result.push(`~${escapeV2(span.slice(2, -2))}~`);
    } else if (span.startsWith("```")) {
      result.push(span);
    } else if (span.startsWith("`")) {
      result.push(span);
    } else if (span.startsWith("_")) {
      result.push(`_${escapeV2(span.slice(1, -1))}_`);
    } else if (span.startsWith("*")) {
      result.push(`_${escapeV2(span.slice(1, -1))}_`);
    }

    lastIndex = match.index! + span.length;
  }

  result.push(escapeV2(text.slice(lastIndex)));
  return result.join("");
}

// ─── Strip Markdown ───────────────────────────────────────────────────────────
// Removes all common Markdown markers, leaving clean readable plain text.
// Used as a fallback when MarkdownV2 rendering fails.

export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]+?```/g, (m) => m.slice(3, -3))  // ```block``` → block
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")                // **bold** → bold
    .replace(/~~([\s\S]+?)~~/g, "$1")                    // ~~strike~~ → strike
    .replace(/_([\s\S]+?)_/g, "$1")                      // _italic_ → italic
    .replace(/\*([\s\S]+?)\*/g, "$1")                    // *italic* → italic
    .replace(/`([^`]+)`/g, "$1");                        // `code` → code
}

// ─── Language detection ───────────────────────────────────────────────────────
// 1+ matches against Indonesian patterns → "id". Otherwise → "en".
// Empty/numbers-only/punctuation-only → defaults to "id".

const ID_PATTERNS = [
  /\d+rb\b/,
  /\d+jt\b/,
  /\bribu\b/,
  /\bjuta\b/,
  /\baku\b/,
  /\bsaya\b/,
  /\bgue\b/,
  /\bgw\b/,
  /\bmakan\b/,
  /\bbayar\b/,
  /\bgimana\b/,
  /\bbagaimana\b/,
  /\bpake\b/,
  /\bdari\b/,
  /\bke\b/,
  /\bpindahin\b/,
  /\btransfer\b/,
  /\bdi\b/,
  /\byang\b/,
  /\bdan\b/,
  /\bhapus\b/,
  /\bcatat\b/,
  /\bmasuk\b/,
  /\bkeluar\b/,
  /\bbulan\b/,
  /\bhari\b/,
  /\btadi\b/,
];

export function detectLanguage(text: string): "id" | "en" {
  if (!text || !/[a-zA-Z]/.test(text)) return "id";
  const lower = text.toLowerCase();
  return ID_PATTERNS.some((p) => p.test(lower)) ? "id" : "en";
}
