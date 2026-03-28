import type { ParsedMessage } from "../schemas";

// Implemented in Phase 2.
// Converts a raw Telegram message + active pocket list into a structured ParsedMessage.
// Uses: import { generateObject, gateway } from "ai"
// Model: gateway(process.env.AI_MODEL ?? "anthropic/claude-sonnet-4-5")
// Schema: ParsedMessageSchema passed directly to generateObject for structured output.
export async function parseMessage(
  _text: string,
  _activePockets: string[]
): Promise<ParsedMessage> {
  return { intent: "unknown", confidence: 0 };
}
