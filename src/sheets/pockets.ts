import type { Pocket } from "../schemas";
import { PocketSchema } from "../schemas";
import { getSheets, getSpreadsheetId } from "./client";

// ─── Meta sheet helpers ───────────────────────────────────────────────────────

async function getMetaRows(): Promise<Array<[string, string]>> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: "meta!A:B",
  });
  const rows = (res.data.values ?? []) as string[][];
  // Row 0 is the header; skip it
  return rows.slice(1).map((r) => [r[0] ?? "", r[1] ?? ""]);
}

// Returns the 1-based sheet row number for a given meta key.
async function findMetaRowNumber(key: string): Promise<number> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: "meta!A:B",
  });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => r[0] === key);
  if (idx === -1) throw new Error(`Meta key not found: ${key}`);
  return idx + 1; // 1-based sheet row
}

async function appendMetaRow(key: string, value: string): Promise<void> {
  await getSheets().spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: "meta!A:B",
    valueInputOption: "RAW",
    requestBody: { values: [[key, value]] },
  });
}

async function updateMetaRow(key: string, newKey: string, value: string): Promise<void> {
  const row = await findMetaRowNumber(key);
  await getSheets().spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `meta!A${row}:B${row}`,
    valueInputOption: "RAW",
    requestBody: { values: [[newKey, value]] },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getAllPockets(): Promise<Pocket[]> {
  const rows = await getMetaRows();
  return rows
    .filter(([key]) => key.startsWith("pocket:"))
    .flatMap(([key, value]) => {
      const result = PocketSchema.safeParse({ name: key.slice(7), status: value });
      return result.success ? [result.data] : [];
    });
}

export async function getActivePocketNames(): Promise<string[]> {
  const pockets = await getAllPockets();
  return pockets.filter((p) => p.status === "active").map((p) => p.name);
}

export async function addPocket(name: string): Promise<Pocket> {
  const existing = await getAllPockets();
  if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Pocket "${name}" already exists`);
  }
  await appendMetaRow(`pocket:${name}`, "active");
  return { name, status: "active" };
}

export async function renamePocket(oldName: string, newName: string): Promise<Pocket> {
  const existing = await getAllPockets();
  const pocket = existing.find((p) => p.name.toLowerCase() === oldName.toLowerCase());
  if (!pocket) throw new Error(`Pocket "${oldName}" not found`);

  const conflict = existing.some(
    (p) => p.name.toLowerCase() === newName.toLowerCase() && p.name !== pocket.name
  );
  if (conflict) throw new Error(`Pocket "${newName}" already exists`);

  // Update key AND keep existing status
  await updateMetaRow(`pocket:${pocket.name}`, `pocket:${newName}`, pocket.status);
  return { name: newName, status: pocket.status };
}

export async function archivePocket(name: string): Promise<Pocket> {
  const existing = await getAllPockets();
  const pocket = existing.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!pocket) throw new Error(`Pocket "${name}" not found`);

  await updateMetaRow(`pocket:${pocket.name}`, `pocket:${pocket.name}`, "archived");
  return { name: pocket.name, status: "archived" };
}

export async function restorePocket(name: string): Promise<Pocket> {
  const existing = await getAllPockets();
  const pocket = existing.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!pocket) throw new Error(`Pocket "${name}" not found`);

  await updateMetaRow(`pocket:${pocket.name}`, `pocket:${pocket.name}`, "active");
  return { name: pocket.name, status: "active" };
}
