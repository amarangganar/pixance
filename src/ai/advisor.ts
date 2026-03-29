import { gateway, generateText } from "ai";
import { formatCurrency } from "../utils/format";
import type { FinancialContext } from "../services/analytics";
import { log as rootLog } from "../lib/logger";

const log = rootLog.child({ module: "[advisor]" });

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

// ─── Prompt builder ───────────────────────────────────────────────────────────

function fmt(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}

function buildContext(ctx: FinancialContext): string {
  const { currency, month, year, totalIncome, totalExpense, totalTransferred, surplus, monthlyTransactionCount } = ctx;

  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, month - 1, 1));
  const savingsRate = totalIncome > 0 ? Math.round((surplus / totalIncome) * 100) : null;
  const expenseRate = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : null;

  const lines: string[] = [
    `## Financial Data — ${monthName} ${year} (${currency})`,
    "",
    `Income:    ${fmt(totalIncome, currency)}`,
    `Expenses:  ${fmt(totalExpense, currency)}${expenseRate !== null ? ` (${expenseRate}% of income)` : ""}`,
    `Transfers: ${fmt(totalTransferred, currency)}`,
    surplus >= 0
      ? `Surplus:   ${fmt(surplus, currency)}${savingsRate !== null ? ` (saving ${savingsRate}%)` : ""}`
      : `Deficit:   ${fmt(Math.abs(surplus), currency)} — spending ${fmt(Math.abs(surplus), currency)} more than earning`,
    `Transactions logged this month: ${monthlyTransactionCount}`,
  ];

  if (ctx.categoryBreakdown.length > 0) {
    lines.push("", "### Spending by Category (sorted by amount)");
    const sorted = [...ctx.categoryBreakdown].sort((a, b) => b.total - a.total);
    for (const { category, total, count } of sorted) {
      const pct = totalExpense > 0 && category !== "Salary" && category !== "Freelance" && category !== "Business" && category !== "Investment Returns" && category !== "Gift" && category !== "Other Income"
        ? ` (${Math.round((total / totalExpense) * 100)}% of expenses)`
        : "";
      lines.push(`  ${category}: ${fmt(total, currency)} × ${count}${pct}`);
    }
  }

  if (ctx.pocketBreakdown.length > 0) {
    lines.push("", "### Pocket Activity");
    for (const { pocket, totalIn, totalOut } of ctx.pocketBreakdown) {
      lines.push(`  ${pocket}: in ${fmt(totalIn, currency)} / out ${fmt(totalOut, currency)}`);
    }
  }

  if (ctx.recentTransactions.length > 0) {
    lines.push("", `### Last ${ctx.recentTransactions.length} Transactions`);
    for (const tx of ctx.recentTransactions.slice(0, 10)) {
      if (tx.type === "transfer") {
        lines.push(`  🔄 ${fmt(tx.amount, currency)} ${tx.from_pocket}→${tx.to_pocket}${tx.note ? ` (${tx.note})` : ""}`);
      } else {
        const emoji = tx.type === "income" ? "💰" : "💸";
        lines.push(`  ${emoji} ${fmt(tx.amount, currency)} ${tx.category}${tx.note ? ` · ${tx.note}` : ""}`);
      }
    }
  }

  return lines.join("\n");
}

function buildSystemPrompt(lang: "id" | "en"): string {
  const langInstruction =
    lang === "id"
      ? "Respond in casual Bahasa Indonesia — santai, seperti teman yang paham keuangan, bukan konsultan formal."
      : "Respond in casual English — like a sharp friend who knows finance, not a formal consultant.";

  return `You are a no-bullshit financial advisor. You look at actual numbers and tell it straight.

Your job:
- Identify what's actually going on financially — good and bad
- Call out problem areas with specific numbers (not vague warnings)
- Acknowledge what's working well if anything is
- End with 1–3 concrete, specific action steps tailored to THIS data — not generic platitudes like "spend less"
- Be direct, be real, skip the fluff
- You may use Markdown formatting where it genuinely helps readability (**bold**, _italic_, ~~strikethrough~~, • bullets) — but don't force it
- Never end with offers to help further, invitations to ask follow-up questions, or filler like "Let me know if…" — this is a one-shot message, not a conversation

${langInstruction}`;
}

function buildUserPrompt(ctx: FinancialContext, userMessage?: string): string {
  const contextBlock = buildContext(ctx);
  const sparseNote =
    ctx.monthlyTransactionCount < 5
      ? "\nNote: very few transactions logged this month — acknowledge sparse data but still analyze what's there."
      : "";

  const questionLine = userMessage
    ? `\nUser's question: "${userMessage}"\n\nAnswer their question AND give a financial assessment based on the data.`
    : "\nGive a sharp financial assessment of the above data.";

  return `${contextBlock}${sparseNote}${questionLine}`;
}

// ─── Fallback messages ────────────────────────────────────────────────────────

const FALLBACK: Record<"id" | "en", string> = {
  id: "❌ Gagal mengambil analisis keuangan. Coba lagi nanti.",
  en: "❌ Failed to fetch financial analysis. Please try again later.",
};

// ─── Advice functions ─────────────────────────────────────────────────────────

export async function getAdvice(userMessage: string, ctx: FinancialContext): Promise<string> {
  try {
    const { text } = await generateText({
      model: gateway(process.env.AI_MODEL ?? "anthropic/claude-sonnet-4-5"),
      system: buildSystemPrompt(ctx.lang),
      prompt: buildUserPrompt(ctx, userMessage),
    });
    return text;
  } catch (err) {
    log.error("generateText failed", err);
    return FALLBACK[ctx.lang];
  }
}

export async function getQuickSummary(ctx: FinancialContext): Promise<string> {
  try {
    const { text } = await generateText({
      model: gateway(process.env.AI_MODEL ?? "anthropic/claude-sonnet-4-5"),
      system: buildSystemPrompt(ctx.lang),
      prompt: buildUserPrompt(ctx),
    });
    return text;
  } catch (err) {
    log.error("generateText failed", err);
    return FALLBACK[ctx.lang];
  }
}
