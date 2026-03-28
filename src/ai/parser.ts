import { gateway, generateObject } from "ai";
import { ParsedMessageSchema, type ParsedMessage } from "../schemas";

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
- income: receiving money ("gajian", "dapat duit", "salary", "terima")
- expense: spending money ("beli", "makan", "bayar", "kopi", default for ambiguous spending)
- transfer: moving money between pockets ("transfer X ke Y", "top up Y dari X", "pindahin X ke Y")
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

## Confidence
- 0.9+ → all fields clearly identified
- 0.7–0.9 → most fields clear, minor ambiguity
- 0.5–0.7 → some ambiguity
- < 0.5 → unclear or probably not a transaction

## Message
"${text}"`;
}

export async function parseMessage(text: string, activePockets: string[]): Promise<ParsedMessage> {
  try {
    const { object } = await generateObject({
      model: gateway(process.env.AI_MODEL ?? "anthropic/claude-sonnet-4-5"),
      schema: ParsedMessageSchema,
      prompt: buildPrompt(text, activePockets),
    });
    return object;
  } catch {
    return { intent: "unknown", confidence: 0 };
  }
}
