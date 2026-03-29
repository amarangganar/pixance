import { gateway, generateObject, jsonSchema } from "ai";
import { ALL_CATEGORIES, ParsedMessageSchema, type ParsedMessage } from "../schemas";

// Hand-crafted JSON schema with ALL fields in `required` and nullable
// fields expressed via anyOf. Required by OpenAI's strict structured-output
// mode, which rejects schemas where any property is absent from `required`.
const PARSER_SCHEMA = jsonSchema<ParsedMessage>({
  type: "object",
  properties: {
    intent: {
      type: "string",
      enum: ["income", "expense", "transfer", "query", "advice", "delete", "unknown"],
    },
    amount: { anyOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "null" }] },
    category: { anyOf: [{ type: "string", enum: [...ALL_CATEGORIES] }, { type: "null" }] },
    note: { anyOf: [{ type: "string" }, { type: "null" }] },
    pocket: { anyOf: [{ type: "string" }, { type: "null" }] },
    from_pocket: { anyOf: [{ type: "string" }, { type: "null" }] },
    to_pocket: { anyOf: [{ type: "string" }, { type: "null" }] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["intent", "amount", "category", "note", "pocket", "from_pocket", "to_pocket", "confidence"],
  additionalProperties: false,
});

function buildPrompt(text: string, activePockets: string[]): string {
  const pocketList = activePockets.length > 0 ? activePockets.join(", ") : "Main";
  return `Parse the following personal finance message and extract structured transaction data.

Active pockets: ${pocketList}

## IDR Amount Shorthands
- "rb" or "ribu" = × 1,000  (e.g. "25rb" → 25000, "500rb" → 500000)
- "jt" or "juta" = × 1,000,000  (e.g. "2jt" → 2000000, "1.5jt" → 1500000)
- "mio" or "m" = × 1,000,000  (e.g. "3mio" → 3000000, "1.5m" → 1500000)
- "k" = × 1,000  (e.g. "25k" → 25000)
Return amount as a plain number (no commas).

## Pocket Matching
Match pocket name from the active pockets list (case-insensitive, exact match).
- "pake gopay" → pocket: "Gopay" (if "Gopay" is active)
- "ke BCA" for income → pocket: "BCA"
- No match → omit pocket field (caller will default to first active pocket)

## Intent Detection
- income: receiving money ("gajian", "dapat duit", "salary", "terima", "tambah ke [pocket]", "add to [pocket]", "add [amount] to [pocket]"). Rule: "tambah/add X ke/to [single pocket]" with NO source pocket mentioned → income, NOT transfer.
- expense: spending money ("beli", "makan", "bayar", "kopi", default for ambiguous spending)
- transfer: moving money between pockets ("transfer X ke Y", "top up Y dari X", "pindahin X ke Y"). Requires TWO pockets (source and destination). "tambah/add ke [single pocket]" is NOT a transfer.
- query: asking about finances without recording ("gimana", "berapa", "how", "show me", "laporan", "report")
- advice: asking for financial advice ("saran", "advice", "suggest")
- delete: deleting a transaction ("hapus", "delete", "batalin")
- unknown: none of the above

## Category Mapping
Expenses:
- Food, makan, kopi, minum, lunch, dinner, breakfast, cafe, resto, jajan, snack → "Food & Drinks"
- Transport, ojek, grab, gojek, bensin, parkir, tol, taxi, bus, commute → "Transport"
- Belanja, shopping, beli baju, beli barang, fashion, elektronik → "Shopping"
- Tagihan, listrik, air, internet, wifi, telpon, pulsa, token → "Bills & Utilities"
- Obat, dokter, kesehatan, apotek, klinik, rumah sakit, check up → "Health"
- Hiburan, nonton, game, bioskop, konser, streaming → "Entertainment"
- Kursus, buku, sekolah, kuliah, kelas, les, training → "Education"
- Salon, potong rambut, spa, perawatan diri, barbershop → "Personal Care"
- Kost, sewa, kontrakan, rent → "Housing & Rent"
- Subscription, netflix, spotify, icloud, domain → "Subscriptions"
- Anything else → "Other"

Income:
- Gaji, gajian, slip gaji, salary → "Salary"
- Freelance, project, klien, client, jasa → "Freelance"
- Bisnis, jualan, usaha, dagang → "Business"
- Investasi, dividen, return, profit trading → "Investment Returns"
- Hadiah, kado, gift, bonus → "Gift"
- Anything else income → "Other Income"

## Note Field
Always populate 'note' with a short description of the specific item or purpose — this is the most important label for identifying the transaction later.
- Extract the item/purpose word(s) from the message: "kopi", "makan siang", "jabatan", "listrik", "gojek ke kantor"
- Pocket information ("pake gopay", "ke BCA") does NOT replace the note — extract both independently
- If the message is only an amount with no description (e.g. "5k"), leave note empty
- Keep it short: 1–4 words max

## Confidence
- 0.9+ → all fields clearly identified
- 0.7–0.9 → most fields clear, minor ambiguity
- 0.5–0.7 → some ambiguity
- < 0.5 → unclear or probably not a transaction

## Examples
"kopi 25rb pake gopay" → intent: expense, amount: 25000, note: kopi, pocket: Gopay, category: Food & Drinks, confidence: 0.95
"beli jabatan 5k" → intent: expense, amount: 5000, note: jabatan, category: Other, confidence: 0.9
"beli jabatan 5k pake jago" → intent: expense, amount: 5000, note: jabatan, pocket: Jago, category: Other, confidence: 0.95
"gajian 8jt ke BCA" → intent: income, amount: 8000000, note: gajian, pocket: BCA, category: Salary, confidence: 0.95
"tambah 794173 ke BCA" → intent: income, amount: 794173, pocket: BCA, category: Other Income, confidence: 0.9
"Add 794173 to BCA" → intent: income, amount: 794173, pocket: BCA, category: Other Income, confidence: 0.9
"tambah ke Gopay 500rb" → intent: income, amount: 500000, pocket: Gopay, category: Other Income, confidence: 0.9
"transfer BCA ke Gopay 1jt" → intent: transfer, amount: 1000000, from_pocket: BCA, to_pocket: Gopay, confidence: 0.95
"bayar listrik 150rb" → intent: expense, amount: 150000, note: listrik, category: Bills & Utilities, confidence: 0.9

## Message
"${text}"`;
}

export async function parseMessage(text: string, activePockets: string[]): Promise<ParsedMessage> {
  try {
    const { object } = await generateObject({
      model: gateway(process.env.AI_MODEL ?? "anthropic/claude-sonnet-4-5"),
      schema: PARSER_SCHEMA,
      prompt: buildPrompt(text, activePockets),
    });
    const result = ParsedMessageSchema.safeParse(object);
    return result.success ? result.data : { intent: "unknown", confidence: 0, amount: null, category: null, note: null, pocket: null, from_pocket: null, to_pocket: null };
  } catch (err) {
    console.error("[parser] generateObject failed:", err);
    return { intent: "unknown", confidence: 0, amount: null, category: null, note: null, pocket: null, from_pocket: null, to_pocket: null };
  }
}
