// ============================================================================
// "Check allotment status" link, per IPO — built from the registrar name
// this app already tracks (src/lib/ipoProviders/nseProvider.ts fills it
// when NSE publishes one; manual entry can fill it too). Every IPO's
// allotment is checked on its REGISTRAR's website (KFin, Link Intime,
// Bigshare, etc.), not on NSE/BSE — the registrar runs the actual share
// allotment process.
//
// HONEST CAVEAT, same as every other external reference in this app: the
// URLs below are each registrar's general-purpose IPO-status-check page,
// from general knowledge of these well-established, long-running sites —
// not independently verified live (this sandbox can't reach them either).
// None of them can be deep-linked to one specific IPO — every registrar's
// tool works by having the visitor pick the company from a dropdown/search
// on their own page, so this gets the user to the RIGHT site, not a
// pre-filled result. If a mapped URL ever turns out stale, it's a one-line
// fix here; unrecognized/unmapped registrars fall back to a Google search
// instead of a dead link, so this never fully fails for any IPO.
// ============================================================================

interface RegistrarEntry {
  /** Matched against the IPO's registrar field, case-insensitively, as a substring — registrar names in the data are free text ("KFin Technologies Limited" vs "KFin Technologies"), so exact matching would miss most rows. */
  match: string;
  name: string;
  statusUrl: string;
}

const REGISTRARS: RegistrarEntry[] = [
  { match: "kfin", name: "KFin Technologies", statusUrl: "https://ipostatus.kfintech.com/" },
  { match: "karvy", name: "KFin Technologies", statusUrl: "https://ipostatus.kfintech.com/" }, // KFin's former name
  { match: "link intime", name: "Link Intime", statusUrl: "https://linkintime.co.in/initial_offer/public-issues.html" },
  { match: "mufg intime", name: "Link Intime", statusUrl: "https://linkintime.co.in/initial_offer/public-issues.html" }, // Link Intime's current brand name
  { match: "bigshare", name: "Bigshare Services", statusUrl: "https://ipo.bigshareonline.com/ipo_status.html" },
  { match: "cameo", name: "Cameo Corporate Services", statusUrl: "https://ipo.cameoindia.com/" },
  { match: "skyline", name: "Skyline Financial Services", statusUrl: "https://www.skylinerta.com/ipo.php" },
  { match: "purva", name: "Purva Sharegistry", statusUrl: "https://www.purvashare.com/investor-services/ipo-allotment-status/" },
  { match: "integrated", name: "Integrated Registry", statusUrl: "https://intimeindia.integratedindia.in/ipostatus.html" },
];

export interface AllotmentLink {
  url: string;
  /** true when this points straight at the matched registrar's own tool; false when it's a Google-search fallback because the registrar wasn't recognized (or isn't set yet). */
  isDirect: boolean;
  label: string;
}

export function getAllotmentLink(registrar: string, ipoName: string): AllotmentLink {
  const normalized = registrar.trim().toLowerCase();
  const found = normalized ? REGISTRARS.find((r) => normalized.includes(r.match)) : undefined;

  if (found) {
    return { url: found.statusUrl, isDirect: true, label: `Check on ${found.name}` };
  }

  const query = registrar.trim() ? `${ipoName} IPO allotment status ${registrar}` : `${ipoName} IPO allotment status`;
  return {
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    isDirect: false,
    label: "Search allotment status",
  };
}
