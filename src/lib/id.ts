import { randomUUID } from "crypto";

/** Short, URL-safe unique ID (first 8 chars of a UUID + timestamp suffix for readability). */
export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID().split("-")[0]}${Date.now().toString(36)}`;
}

export function num(value: unknown, fallback = 0): number {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}
