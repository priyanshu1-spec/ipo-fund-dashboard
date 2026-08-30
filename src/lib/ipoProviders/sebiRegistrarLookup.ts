// ============================================================================
// SEBI RHP/DRHP registrar lookup — free, local-only, no paid/AI service.
//
// Source chain, all plain fetch() + local parsing, exactly like every other
// provider in this app:
//   1. SEBI's own public "Filings -> Public Issues" listing page
//      (sebi.gov.in/filings/public-issues.html), which links to each
//      company's own filing page.
//   2. That filing page, which links to the actual PDF (RHP / DRHP /
//      Abridged Prospectus).
//   3. The PDF's text, extracted locally with pdf-parse (a pure-JS text
//      extractor — no AI/LLM involved anywhere in this file, and no
//      network calls beyond the three fetches above). This is the direct
//      Node equivalent of Python's pypdf/pdfplumber for this Next.js/
//      TypeScript codebase — there is no Python runtime here to run
//      PyMuPDF/pdfplumber/pypdf themselves, so pdf-parse is the same kind
//      of tool, not a different kind of approach.
//   4. A local keyword search (no AI) for "Registrar to the Issue" and its
//      known variants, extracting the company-name-shaped text and any
//      URL-shaped text immediately following it.
//
// CONFIDENCE CAVEAT — read before trusting this blindly: this exact page/
// PDF structure could not be verified by actually loading sebi.gov.in from
// this development sandbox — its network egress proxy blocks sebi.gov.in
// outright (same as nseindia.com and bseindia.com; this is a sandbox
// network policy, not evidence the sites themselves are unreachable). The
// URL pattern and page shape coded below are built from real, independently
// -indexed SEBI filing URLs found via web search (e.g.
// sebi.gov.in/filings/public-issues/aug-2026/symbiotec-pharmalab-limited-rhp_103750.html)
// across many different companies and months, which is why this was built
// (not just NSE-style JSON-endpoint confidence, but real corroborating
// evidence) rather than skipped — but it is genuinely unverified live, the
// same honest position nseProvider.ts started from. The real test is the
// first "Refresh IPO Data" click in production.
//
// FAILS SAFE, ALWAYS: every step here returns undefined/null (never
// throws) on any HTTP error, timeout, unexpected markup, or missing match.
// If SEBI's real markup doesn't match what's coded here, this simply finds
// nothing — the registrar still shows up as "New Registrar Detected" in
// /admin for a human to look up manually, exactly as it did before this
// file existed. Nothing here is ever treated as confirmed fact.
//
// WHAT THIS NEVER DOES: write anything to the registrars table itself,
// mark anything verified, or synthesize an allotment-status URL from a
// domain name. Its only output is a SUGGESTION — a candidate registrar
// name/domain/source-document shown on the "New Registrar Detected" card
// in /admin, pre-filling (never auto-saving) the URL field an admin must
// still explicitly review and save. See repositories/registrars.ts and
// ipoSync.ts for how the result is used.
// ============================================================================

import * as cheerio from "cheerio";
import { BROWSER_HEADERS, normalizeCompanyName } from "./htmlTableUtils";

const SEBI_LISTING_URL = "https://www.sebi.gov.in/filings/public-issues.html";
const SEBI_ORIGIN = "https://www.sebi.gov.in";
const REQUEST_TIMEOUT_MS = 8_000;

export interface SebiRegistrarCandidate {
  /** The registrar name as it appears right after the "Registrar to the Issue" heading in the PDF — may differ slightly in spelling/formatting from whatever NSE's registrar field said; shown to the admin as a second, independently-sourced data point, not silently merged. */
  registrarName: string;
  /** A URL-shaped string found near the registrar name (e.g. "kfintech.com") — a starting guess for the admin's allotment-URL field, never saved automatically. */
  registrarDomain?: string;
  /** The SEBI filing page this came from, so the admin can click through and verify against the real document instead of trusting this module's extraction blindly. */
  filingUrl: string;
  /** The raw ~300-character text window this was extracted from, for the same reason. */
  snippet: string;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Finds the SEBI filing page for a company by fuzzy-matching against SEBI's
 * own public-issues listing — never guesses a filing URL from the company
 * name alone (SEBI's numeric filing IDs, e.g. "_103750", aren't derivable
 * without seeing the real listing).
 */
async function findFilingUrl(companyName: string): Promise<string | undefined> {
  const html = await fetchText(SEBI_LISTING_URL);
  if (!html) return undefined;
  const $ = cheerio.load(html);
  const target = normalizeCompanyName(companyName);
  if (!target) return undefined;

  let bestHref: string | undefined;
  $("a[href*='/filings/public-issues/']").each((_, el) => {
    if (bestHref) return;
    const href = $(el).attr("href") ?? "";
    const linkText = ($(el).text() || href).replace(/-?\s*(rhp|drhp|updated).*$/i, "");
    const normalized = normalizeCompanyName(linkText);
    if (!normalized) return;
    if (normalized === target || normalized.includes(target) || target.includes(normalized)) {
      try {
        bestHref = new URL(href, SEBI_ORIGIN).toString();
      } catch {
        // Malformed href — skip rather than throw.
      }
    }
  });
  return bestHref;
}

/** Finds a downloadable PDF (RHP/DRHP/Abridged Prospectus) linked from a SEBI filing page. */
async function findPdfUrl(filingUrl: string): Promise<string | undefined> {
  const html = await fetchText(filingUrl);
  if (!html) return undefined;
  const $ = cheerio.load(html);
  let pdfHref: string | undefined;
  $("a[href*='.pdf']").each((_, el) => {
    if (pdfHref) return;
    const href = $(el).attr("href");
    if (!href) return;
    try {
      pdfHref = new URL(href, filingUrl).toString();
    } catch {
      // Malformed href — skip.
    }
  });
  return pdfHref;
}

const REGISTRAR_HEADINGS = [
  "registrar to the issue",
  "registrar to the offer",
  "registrar to the ipo",
  "registrar and share transfer agent",
];

/**
 * Local, keyword-based extraction — no AI/LLM. Looks for a known registrar
 * heading and pulls out the company-name-shaped text immediately after it
 * (conventionally how these documents are formatted: heading, then the
 * registrar's own name on the next line, ending in "Limited"). Deliberately
 * conservative — returns undefined rather than a shaky guess when nothing
 * clearly matches, since this app treats "nothing found" as strictly safer
 * than a wrong name shown to an admin as if it were reliable.
 */
function extractRegistrarFromText(text: string): { name: string; domain?: string; snippet: string } | undefined {
  const lower = text.toLowerCase();
  for (const heading of REGISTRAR_HEADINGS) {
    const idx = lower.indexOf(heading);
    if (idx === -1) continue;
    const window = text.slice(idx, idx + 400);
    const nameMatch = window
      .slice(heading.length)
      .match(/([A-Z][A-Za-z.&'\-\s]{2,80}?\b(?:Private\s+)?Limited\b)/);
    if (!nameMatch) continue;
    const urlMatch = window.match(/\b(?:www\.)?[a-z0-9-]+\.(?:com|in|co\.in|net)\b/i);
    return {
      name: nameMatch[1].replace(/\s+/g, " ").trim(),
      domain: urlMatch ? urlMatch[0].replace(/^www\./i, "").toLowerCase() : undefined,
      snippet: window.replace(/\s+/g, " ").trim().slice(0, 300),
    };
  }
  return undefined;
}

/**
 * Best-effort end-to-end lookup: SEBI listing -> filing page -> PDF ->
 * local text extraction. Never throws — every failure mode (network,
 * timeout, unrecognized markup, no match) resolves to undefined so a
 * caller can always safely fall back to "New Registrar Detected with no
 * suggestion", exactly the behavior that existed before this module did.
 */
export async function lookupSebiRegistrar(companyName: string): Promise<SebiRegistrarCandidate | undefined> {
  try {
    const filingUrl = await findFilingUrl(companyName);
    if (!filingUrl) return undefined;
    const pdfUrl = await findPdfUrl(filingUrl);
    if (!pdfUrl) return undefined;

    const pdfRes = await fetch(pdfUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS * 2),
    });
    if (!pdfRes.ok) return undefined;
    const buffer = Buffer.from(await pdfRes.arrayBuffer());

    // Local extraction only — pdf-parse is a pure-JS PDF text extractor,
    // no network calls, no AI/LLM. See package.json.
    const pdfParse = (await import("pdf-parse")).default;
    const { text } = await pdfParse(buffer);

    const found = extractRegistrarFromText(text);
    if (!found) return undefined;
    return { registrarName: found.name, registrarDomain: found.domain, filingUrl, snippet: found.snippet };
  } catch {
    return undefined;
  }
}
