import type { Transaction } from "../schemas";

// Orchestrates parse → validate → write flow.
// Implemented in Phase 2.

export async function recordTransaction(_text: string, _chatId: number): Promise<Transaction> {
  throw new Error("Not implemented — Phase 2");
}
