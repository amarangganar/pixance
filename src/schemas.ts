import { z } from "zod";

// ─── Canonical values ────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = [
  "Food & Drinks",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Health",
  "Entertainment",
  "Education",
  "Personal Care",
  "Housing & Rent",
  "Subscriptions",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Investment Returns",
  "Gift",
  "Other Income",
] as const;

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const;

// ─── Pocket schema ───────────────────────────────────────────────────────────

export const PocketStatusSchema = z.enum(["active", "archived"]);

export const PocketSchema = z.object({
  name: z.string().min(1).max(32),
  status: PocketStatusSchema,
});

// ─── Transaction schema (discriminated union on type) ─────────────────────────

export const TransactionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    type: z.enum(["income", "expense"]),
    amount: z.number().positive(),
    category: z.enum(ALL_CATEGORIES),
    note: z.string().default(""),
    pocket: z.string().min(1),
    from_pocket: z.literal("").default(""),
    to_pocket: z.literal("").default(""),
  }),
  z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime(),
    type: z.literal("transfer"),
    amount: z.number().positive(),
    category: z.literal("").default(""),
    note: z.string().default(""),
    pocket: z.literal("").default(""),
    from_pocket: z.string().min(1),
    to_pocket: z.string().min(1),
  }),
]);

// ─── Parsed message schema ───────────────────────────────────────────────────

export const ParsedMessageSchema = z.object({
  intent: z.enum(["income", "expense", "transfer", "query", "advice", "delete", "unknown"]),
  amount: z.number().positive().nullable().default(null),
  category: z.enum(ALL_CATEGORIES).nullable().default(null),
  note: z.string().nullable().default(null),
  pocket: z.string().nullable().default(null),
  from_pocket: z.string().nullable().default(null),
  to_pocket: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
});

// ─── Telegram schemas (only fields we use) ───────────────────────────────────

export const TelegramMessageSchema = z.object({
  message_id: z.number(),
  from: z.object({
    id: z.number(),
    first_name: z.string().optional(),
    username: z.string().optional(),
  }),
  chat: z.object({ id: z.number() }),
  text: z.string().optional(),
});

export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: TelegramMessageSchema.optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type Pocket = z.infer<typeof PocketSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type ParsedMessage = z.infer<typeof ParsedMessageSchema>;
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
