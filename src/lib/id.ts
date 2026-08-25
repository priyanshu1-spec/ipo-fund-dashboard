// Works in both the browser and any server context — uses the standard Web
// Crypto API (available on window in browsers and globally in modern Node),
// rather than Node's `crypto` module directly, which isn't available in
// client bundles.

function randomHex(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().split("-")[0];
  }
  return Math.random().toString(16).slice(2, 10);
}

/** Short, URL-safe unique ID (first 8 chars of a UUID + timestamp suffix for readability). */
export function generateId(prefix: string): string {
  return `${prefix}_${randomHex()}${Date.now().toString(36)}`;
}

export function num(value: unknown, fallback = 0): number {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}
