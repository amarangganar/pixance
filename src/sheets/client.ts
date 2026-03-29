import type { sheets_v4 } from "googleapis";
import { google } from "googleapis";
import { log as rootLog } from "../lib/logger";

const log = rootLog.child({ module: "[sheets]" });

// ─── Client singleton ─────────────────────────────────────────────────────────

let _sheets: sheets_v4.Sheets;
let _spreadsheetId: string;

export function initSheetsClient(): void {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "{}");
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  _sheets = google.sheets({ version: "v4", auth });
  _spreadsheetId = process.env.SPREADSHEET_ID ?? "";
  log.info("sheets client initialized");
}

export function getSheets(): sheets_v4.Sheets {
  return _sheets;
}

export function getSpreadsheetId(): string {
  return _spreadsheetId;
}

// ─── Sheet initialization ─────────────────────────────────────────────────────

const TX_HEADERS = [
  "id",
  "timestamp",
  "type",
  "amount",
  "category",
  "note",
  "pocket",
  "from_pocket",
  "to_pocket",
];
const META_HEADERS = ["key", "value"];

async function ensureSheet(title: string, headers: string[]): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const sheets = getSheets();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = spreadsheet.data.sheets?.some((s) => s.properties?.title === title);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    return;
  }

  // Sheet exists — write headers if first row is empty
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
  });
  if (!res.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

async function seedMetaDefaults(): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "meta!A:B" });
  const rows = (res.data.values ?? []) as string[][];
  // Skip header row (index 0)
  const data = rows.slice(1);
  const metaMap = new Map(data.map((r) => [r[0] ?? "", r[1] ?? ""]));

  const toAppend: string[][] = [];
  if (!metaMap.has("currency")) toAppend.push(["currency", "IDR"]);
  if (!metaMap.has("timezone")) toAppend.push(["timezone", "Asia/Jakarta"]);
  if (![...metaMap.keys()].some((k) => k.startsWith("pocket:"))) {
    toAppend.push(["pocket:Main", "active"]);
  }

  if (toAppend.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "meta!A:B",
      valueInputOption: "RAW",
      requestBody: { values: toAppend },
    });
  }
}

export async function initSheets(): Promise<void> {
  await ensureSheet("transactions", TX_HEADERS);
  await ensureSheet("meta", META_HEADERS);
  await seedMetaDefaults();
  log.info("sheets initialized");
}

// ─── Config reader ────────────────────────────────────────────────────────────

export async function readConfigFromMeta(): Promise<{ currency: string; timezone: string }> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: "meta!A:B",
  });
  const rows = (res.data.values ?? []) as string[][];
  const metaMap = new Map(rows.slice(1).map((r) => [r[0] ?? "", r[1] ?? ""]));

  return {
    currency: metaMap.get("currency") ?? "IDR",
    timezone: metaMap.get("timezone") ?? "Asia/Jakarta",
  };
}
