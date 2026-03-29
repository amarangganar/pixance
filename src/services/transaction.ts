import type { ParsedMessage, Transaction } from "../schemas";
import { appendTransaction } from "../sheets/transactions";

// Pocket matching: exact case-insensitive; no match → first active pocket.
function resolvePocket(name: string | null | undefined, activePockets: string[]): string {
  if (name) {
    const match = activePockets.find((p) => p.toLowerCase() === name.toLowerCase());
    if (match) return match;
  }
  return activePockets[0] ?? "Main";
}

export async function buildAndSaveTransaction(
  parsed: ParsedMessage,
  activePockets: string[]
): Promise<Transaction> {
  const now = new Date().toISOString();

  if (parsed.intent === "transfer") {
    const txData: Omit<Transaction, "id"> = {
      timestamp: now,
      type: "transfer",
      amount: parsed.amount!,
      category: "",
      note: parsed.note ?? "",
      pocket: "",
      from_pocket: resolvePocket(parsed.from_pocket, activePockets),
      to_pocket: resolvePocket(parsed.to_pocket, activePockets),
    };
    return appendTransaction(txData);
  }

  const pocket = resolvePocket(parsed.pocket, activePockets);
  const defaultCategory = parsed.intent === "income" ? ("Other Income" as const) : ("Other" as const);
  const txData: Omit<Transaction, "id"> = {
    timestamp: now,
    type: parsed.intent as "income" | "expense",
    amount: parsed.amount!,
    category: parsed.category ?? defaultCategory,
    note: parsed.note ?? "",
    pocket,
    from_pocket: "",
    to_pocket: "",
  };
  return appendTransaction(txData);
}
