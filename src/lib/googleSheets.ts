// ============================================================================
// Generic Google Sheets data-access layer.
//
// Every "table" in this app is a tab in one Google Spreadsheet (GOOGLE_SHEET_ID).
// Row 1 of each tab is a header row whose column names match the `headers`
// array passed in by each repository (see src/lib/repositories/*.ts). This
// module knows nothing about specific entities — it just converts between
// spreadsheet rows (string[][]) and plain objects (Record<string, string>),
// and provides read/append/update/delete primitives with an in-memory TTL
// cache to stay well under Google Sheets API quota (60 reads/min/user).
// ============================================================================

import { google, sheets_v4 } from "googleapis";
import { JWT } from "google-auth-library";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

let cachedClient: sheets_v4.Sheets | null = null;
let cachedSheetIdMap: Map<string, number> | null = null;

function getCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. " +
        "See docs/GOOGLE_SHEETS_SETUP.md."
    );
  }
  // Env vars store literal \n sequences; convert to real newlines for the PEM key.
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return { email, privateKey };
}

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const { email, privateKey } = getCredentials();
  const auth = new JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

function requireSpreadsheetId(): string {
  if (!SPREADSHEET_ID) {
    throw new Error("Missing GOOGLE_SHEET_ID. See docs/GOOGLE_SHEETS_SETUP.md.");
  }
  return SPREADSHEET_ID;
}

/** Resolves the numeric sheetId (needed for row deletion) for a given tab name. */
async function getSheetNumericId(tabName: string): Promise<number> {
  if (cachedSheetIdMap?.has(tabName)) return cachedSheetIdMap.get(tabName)!;
  const client = getClient();
  const meta = await client.spreadsheets.get({ spreadsheetId: requireSpreadsheetId() });
  const map = new Map<string, number>();
  for (const s of meta.data.sheets ?? []) {
    if (s.properties?.title != null && s.properties.sheetId != null) {
      map.set(s.properties.title, s.properties.sheetId);
    }
  }
  cachedSheetIdMap = map;
  if (!map.has(tabName)) {
    throw new Error(
      `Tab "${tabName}" not found in the spreadsheet. Create it with the exact headers ` +
        `documented in docs/SCHEMA.md.`
    );
  }
  return map.get(tabName)!;
}

/** Ensures a tab exists with the given header row; creates it if missing. */
export async function ensureTab(tabName: string, headers: string[]): Promise<void> {
  const client = getClient();
  const spreadsheetId = requireSpreadsheetId();
  const meta = await client.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === tabName);
  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
  }
  cachedSheetIdMap = null;
  const existingHeaderRow = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:ZZ1`,
  });
  const currentHeaders = existingHeaderRow.data.values?.[0] ?? [];
  if (currentHeaders.length === 0) {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

// --- Tiny in-memory TTL cache (per server instance) -------------------------
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.data as T;
}

function cacheSet(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateTab(tabName: string) {
  cache.delete(`rows:${tabName}`);
}

// --- Row <-> object mapping ---------------------------------------------------

export interface SheetRecord {
  /** 1-based row number in the sheet, including the header row (row 1 = headers). */
  _rowNumber: number;
  [key: string]: string | number;
}

function rowToRecord(headers: string[], row: string[], rowNumber: number): SheetRecord {
  const record: SheetRecord = { _rowNumber: rowNumber };
  headers.forEach((h, i) => {
    record[h] = row[i] ?? "";
  });
  return record;
}

function recordToRow(headers: string[], obj: Record<string, unknown>): string[] {
  return headers.map((h) => {
    const v = obj[h];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

/** Reads all data rows (excluding header) from a tab as raw string-keyed records. */
export async function readAllRows(tabName: string, headers: string[]): Promise<SheetRecord[]> {
  const cacheKey = `rows:${tabName}`;
  const cached = cacheGet<SheetRecord[]>(cacheKey);
  if (cached) return cached;

  const client = getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: requireSpreadsheetId(),
    range: `${tabName}!A2:ZZ`,
  });
  const rows = res.data.values ?? [];
  const records = rows
    .map((row, i) => rowToRecord(headers, row as string[], i + 2))
    .filter((r) => Object.values(r).some((v) => v !== "" && v !== undefined));
  cacheSet(cacheKey, records);
  return records;
}

/** Appends one row to the end of a tab. */
export async function appendRow(
  tabName: string,
  headers: string[],
  obj: object
): Promise<void> {
  const client = getClient();
  await client.spreadsheets.values.append({
    spreadsheetId: requireSpreadsheetId(),
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [recordToRow(headers, obj as Record<string, unknown>)] },
  });
  invalidateTab(tabName);
}

/** Overwrites a specific row (by 1-based sheet row number) with new values. */
export async function updateRow(
  tabName: string,
  headers: string[],
  rowNumber: number,
  obj: object
): Promise<void> {
  const client = getClient();
  await client.spreadsheets.values.update({
    spreadsheetId: requireSpreadsheetId(),
    range: `${tabName}!A${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [recordToRow(headers, obj as Record<string, unknown>)] },
  });
  invalidateTab(tabName);
}

/** Deletes a specific row (by 1-based sheet row number) entirely. */
export async function deleteRow(tabName: string, rowNumber: number): Promise<void> {
  const client = getClient();
  const sheetId = await getSheetNumericId(tabName);
  await client.spreadsheets.batchUpdate({
    spreadsheetId: requireSpreadsheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
  invalidateTab(tabName);
}

export async function findRowById(
  tabName: string,
  headers: string[],
  id: string
): Promise<SheetRecord | undefined> {
  const rows = await readAllRows(tabName, headers);
  return rows.find((r) => r.id === id);
}
