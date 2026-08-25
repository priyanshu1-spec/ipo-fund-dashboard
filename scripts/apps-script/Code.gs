/**
 * IPO Fund Dashboard — Google Apps Script automated fetch (alternative /
 * companion to the in-app scraper at src/lib/scraper.ts).
 *
 * WHY THIS EXISTS
 * The Next.js app's server may run somewhere with restricted or proxied
 * outbound internet access (e.g. certain sandboxed hosts), and public IPO
 * portals change their HTML without notice either way. Google Apps Script
 * runs directly against your own Google Sheet with Google's normal outbound
 * internet access and no extra hosting, so it's a robust second automation
 * path — use one or both.
 *
 * SETUP
 * 1. Open your IPO Fund Dashboard Google Sheet (the one whose ID is
 *    GOOGLE_SHEET_ID in your .env).
 * 2. Extensions → Apps Script. Delete the default code and paste this file.
 * 3. Update SOURCES below with the page(s) you want to pull from, and
 *    verify/adjust the column-index guesses in parseTableRow() against the
 *    actual page structure — see the comment there.
 * 4. Run `syncIposNow` once manually (you'll be asked to authorize the
 *    script's permissions: UrlFetch + Sheets on this file only).
 * 5. Triggers (clock icon on the left) → Add Trigger → syncIposNow →
 *    Time-driven → Day timer → pick a time. This is your daily automated
 *    sync, independent of the Next.js app's own cron.
 *
 * This script is intentionally simple and defensive: it never deletes rows,
 * only appends new IPOs (matched by name, case-insensitive) or updates the
 * GMP + lastSyncedAt columns of an existing one. Manual edits to dates/price
 * band you've already filled in are left alone.
 */

const SHEET_NAME = "IPO_Master_Data";
const HEADERS = [
  "id", "name", "type", "openDate", "closeDate", "allotmentDate", "refundDate",
  "listingDate", "priceBandMin", "priceBandMax", "lotSize", "issueSize",
  "status", "gmp", "gmpUpdatedAt", "listingPrice", "exchange", "sourceUrl",
  "lastSyncedAt", "notes",
];

// Add the page(s) you want to scrape. `type` must be "Mainboard" or "SME".
const SOURCES = [
  // { url: "https://example.com/ipo-list", type: "Mainboard" },
];

function syncIposNow() {
  const sheet = getOrCreateSheet_();
  const existing = readExistingRows_(sheet);

  SOURCES.forEach(function (source) {
    let html;
    try {
      html = UrlFetchApp.fetch(source.url, { muteHttpExceptions: true }).getContentText();
    } catch (err) {
      Logger.log("Failed to fetch " + source.url + ": " + err);
      return;
    }
    const rows = extractRowsFromHtml_(html, source);
    rows.forEach(function (row) {
      upsertIpo_(sheet, existing, row);
    });
  });
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getRange(1, 1).getValue() === "") {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function readExistingRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const byName = {};
  values.forEach(function (row, i) {
    const name = String(row[1] || "").trim().toLowerCase();
    if (name) byName[name] = { rowNumber: i + 2, values: row };
  });
  return byName;
}

/**
 * Heuristic HTML table parser — mirrors the logic in src/lib/scraper.ts.
 * Looks for any <table> whose header row contains recognizable IPO-related
 * column names, then extracts rows from it. Adjust KEYWORD_MAP if your
 * target site uses different header wording.
 */
function extractRowsFromHtml_(html, source) {
  const KEYWORD_MAP = {
    name: ["company", "ipo name", "issuer", "name"],
    openDate: ["open date", "bid open", "open"],
    closeDate: ["close date", "bid close", "close"],
    priceBand: ["price band", "issue price", "price"],
    lotSize: ["lot size", "min lot", "lot"],
    gmp: ["gmp", "grey market premium", "premium"],
  };

  const results = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];

  tableMatches.forEach(function (tableHtml) {
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rowMatches.length < 2) return;

    const headerCells = extractCells_(rowMatches[0]);
    const fieldMap = headerCells.map(function (cellText) {
      const lower = cellText.trim().toLowerCase();
      for (const field in KEYWORD_MAP) {
        if (KEYWORD_MAP[field].some(function (kw) { return lower.indexOf(kw) !== -1; })) {
          return field;
        }
      }
      return null;
    });

    if (fieldMap.indexOf("name") === -1) return;

    for (let r = 1; r < rowMatches.length; r++) {
      const cells = extractCells_(rowMatches[r]);
      if (cells.length === 0) continue;
      const raw = {};
      cells.forEach(function (text, i) {
        if (fieldMap[i]) raw[fieldMap[i]] = text.trim();
      });
      if (!raw.name) continue;

      const priceBandNums = (raw.priceBand || "").match(/[\d,]+(\.\d+)?/g) || [];
      const prices = priceBandNums.map(function (n) { return parseFloat(n.replace(/,/g, "")); });

      results.push({
        name: raw.name,
        type: source.type,
        openDate: raw.openDate || "",
        closeDate: raw.closeDate || "",
        priceBandMin: prices.length ? Math.min.apply(null, prices) : 0,
        priceBandMax: prices.length ? Math.max.apply(null, prices) : 0,
        lotSize: parseFloat((raw.lotSize || "0").replace(/,/g, "")) || 0,
        gmp: parseFloat((raw.gmp || "0").replace(/,/g, "")) || 0,
        sourceUrl: source.url,
      });
    }
  });

  return results;
}

function extractCells_(rowHtml) {
  const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
  return cellMatches.map(function (cell) {
    return cell.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
  });
}

function upsertIpo_(sheet, existing, row) {
  const key = row.name.trim().toLowerCase();
  const now = new Date().toISOString();
  const found = existing[key];

  if (found) {
    // Only refresh GMP + sync timestamp; never clobber manually-entered dates.
    sheet.getRange(found.rowNumber, HEADERS.indexOf("gmp") + 1).setValue(row.gmp);
    sheet.getRange(found.rowNumber, HEADERS.indexOf("gmpUpdatedAt") + 1).setValue(now);
    sheet.getRange(found.rowNumber, HEADERS.indexOf("lastSyncedAt") + 1).setValue(now);
    return;
  }

  const newRow = HEADERS.map(function (h) {
    switch (h) {
      case "id": return "ipo_" + Utilities.getUuid().split("-")[0] + Date.now().toString(36);
      case "name": return row.name;
      case "type": return row.type;
      case "openDate": return row.openDate;
      case "closeDate": return row.closeDate;
      case "priceBandMin": return row.priceBandMin;
      case "priceBandMax": return row.priceBandMax;
      case "lotSize": return row.lotSize;
      case "status": return "Upcoming";
      case "gmp": return row.gmp;
      case "gmpUpdatedAt": return now;
      case "exchange": return row.type === "SME" ? "NSE SME / BSE SME" : "NSE / BSE";
      case "sourceUrl": return row.sourceUrl;
      case "lastSyncedAt": return now;
      default: return "";
    }
  });
  sheet.appendRow(newRow);
  existing[key] = { rowNumber: sheet.getLastRow(), values: newRow };
}
