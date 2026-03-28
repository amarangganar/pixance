import { v4 as uuidv4 } from "uuid";
import { TransactionSchema, type Transaction } from "../schemas";
import { isInMonth } from "../utils/format";
import { getSheets, getSpreadsheetId } from "./client";

// ─── Row serialization (exported for testing) ─────────────────────────────────

export function rowToTransaction(row: (string | number | undefined)[]): Transaction | null {
  const [id, timestamp, type, amountRaw, category, note, pocket, from_pocket, to_pocket] = row;
  const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw ?? ""));
  if (Number.isNaN(amount)) return null;

  const result = TransactionSchema.safeParse({
    id,
    timestamp,
    type,
    amount,
    category: category ?? "",
    note: note ?? "",
    pocket: pocket ?? "",
    from_pocket: from_pocket ?? "",
    to_pocket: to_pocket ?? "",
  });
  return result.success ? result.data : null;
}

export function transactionToRow(tx: Transaction): string[] {
  if (tx.type === "transfer") {
    return [tx.id, tx.timestamp, "transfer", String(tx.amount), "", tx.note, "", tx.from_pocket, tx.to_pocket];
  }
  return [tx.id, tx.timestamp, tx.type, String(tx.amount), tx.category, tx.note, tx.pocket, "", ""];
}

// ─── Sheets I/O ───────────────────────────────────────────────────────────────

export async function appendTransaction(tx: Omit<Transaction, "id">): Promise<Transaction> {
  const id = uuidv4();
  const fullTx = { ...tx, id } as Transaction;
  const row = transactionToRow(fullTx);

  await getSheets().spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: "transactions!A:I",
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });

  return fullTx;
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: "transactions!A:I",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = (res.data.values ?? []) as (string | number | undefined)[][];
  return rows.slice(1).flatMap((row) => {
    const tx = rowToTransaction(row);
    return tx ? [tx] : [];
  });
}

export async function getMonthlyTransactions(month: number, year: number): Promise<Transaction[]> {
  const all = await getAllTransactions();
  return all.filter((tx) => isInMonth(tx.timestamp, month, year));
}

export async function getMonthlySummary(
  month: number,
  year: number
): Promise<{ totalIncome: number; totalExpense: number; totalTransferred: number }> {
  const txs = await getMonthlyTransactions(month, year);
  return txs.reduce(
    (acc, tx) => {
      if (tx.type === "income") acc.totalIncome += tx.amount;
      else if (tx.type === "expense") acc.totalExpense += tx.amount;
      else acc.totalTransferred += tx.amount;
      return acc;
    },
    { totalIncome: 0, totalExpense: 0, totalTransferred: 0 }
  );
}

export async function getCategoryBreakdown(
  month: number,
  year: number
): Promise<{ category: string; total: number; count: number }[]> {
  const txs = await getMonthlyTransactions(month, year);
  const map = new Map<string, { total: number; count: number }>();
  for (const tx of txs) {
    if (tx.type === "transfer") continue;
    const entry = map.get(tx.category) ?? { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count += 1;
    map.set(tx.category, entry);
  }
  return [...map.entries()].map(([category, { total, count }]) => ({ category, total, count }));
}

export async function getPocketBreakdown(
  month: number,
  year: number
): Promise<{ pocket: string; totalIn: number; totalOut: number }[]> {
  const txs = await getMonthlyTransactions(month, year);
  const map = new Map<string, { totalIn: number; totalOut: number }>();

  const entry = (pocket: string) => {
    if (!map.has(pocket)) map.set(pocket, { totalIn: 0, totalOut: 0 });
    return map.get(pocket)!;
  };

  for (const tx of txs) {
    if (tx.type === "income") {
      entry(tx.pocket).totalIn += tx.amount;
    } else if (tx.type === "expense") {
      entry(tx.pocket).totalOut += tx.amount;
    } else {
      entry(tx.from_pocket).totalOut += tx.amount;
      entry(tx.to_pocket).totalIn += tx.amount;
    }
  }

  return [...map.entries()].map(([pocket, { totalIn, totalOut }]) => ({ pocket, totalIn, totalOut }));
}

export async function getRecentTransactions(limit: number): Promise<Transaction[]> {
  const all = await getAllTransactions();
  return all.slice(-limit).reverse();
}

export async function getLastNDaysTransactions(days: number): Promise<Transaction[]> {
  const all = await getAllTransactions();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return all.filter((tx) => new Date(tx.timestamp) >= cutoff);
}

export function findMatchingTransactions(
  txs: Transaction[],
  amount: number | undefined,
  note: string | undefined
): Transaction[] {
  if (!amount && !note) return [];
  return txs.filter((tx) => {
    const amountOk = amount !== undefined ? tx.amount === amount : true;
    const noteOk = note ? tx.note.toLowerCase().includes(note.toLowerCase()) : true;
    return amountOk && noteOk;
  });
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const idsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "transactions!A:A",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const ids = (idsRes.data.values ?? []) as string[][];
  const rowIndex = ids.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) return false;

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === "transactions");
  if (!sheet?.properties?.sheetId === undefined) return false;
  const sheetId = sheet!.properties!.sheetId!;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}
