import { getCurrency, getTimezone } from "../config";

// ─── Currency formatting ──────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency ?? getCurrency();

  if (cur === "IDR") {
    if (amount < 1_000) return `Rp ${amount}`;
    if (amount < 1_000_000) {
      const rb = amount / 1_000;
      return `Rp ${Number.isInteger(rb) ? rb : rb.toFixed(1)}rb`;
    }
    if (amount < 1_000_000_000) {
      const jt = amount / 1_000_000;
      return `Rp ${Number.isInteger(jt) ? jt : jt.toFixed(1)}jt`;
    }
    const M = amount / 1_000_000_000;
    return `Rp ${Number.isInteger(M) ? M : M.toFixed(1)}M`;
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

// ─── Progress bar ─────────────────────────────────────────────────────────────

export function progressBar(used: number, total: number, length = 10): string {
  if (total <= 0) return "";
  const ratio = Math.min(used / total, 1);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const pct = Math.round(ratio * 100);
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${pct}%`;
}
