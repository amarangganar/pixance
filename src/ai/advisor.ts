import type { FinancialContext } from "../services/analytics";

// ─── Language detection ───────────────────────────────────────────────────────
// 1+ matches against Indonesian patterns → "id". Otherwise → "en".
// Empty/numbers-only/punctuation-only → defaults to "id".

const ID_PATTERNS = [
  /\brb\b/,
  /\bjt\b/,
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

// ─── Advice functions — implemented in Phase 5 ───────────────────────────────
// Uses: import { generateText, gateway } from "ai"
// Model: gateway(process.env.AI_MODEL ?? "anthropic/claude-sonnet-4-5")

export async function getAdvice(_userMessage: string, _ctx: FinancialContext): Promise<string> {
  throw new Error("Not implemented — Phase 5");
}

export async function getQuickSummary(_ctx: FinancialContext): Promise<string> {
  throw new Error("Not implemented — Phase 5");
}
