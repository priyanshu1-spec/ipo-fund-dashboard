"use client";

// ============================================================================
// Client-side data layer. There is no backend/database — every entity list
// (IPOs, Applications, Fund Allocations, Investors) lives entirely in this
// browser's localStorage. That means:
//   - Data is private to this browser/device — it is NOT shared between
//     different people or different devices, even when they use the same
//     link and the same login.
//   - Clearing browser data, using a different browser, or private/incognito
//     mode all start you over with an empty dashboard.
//   - "Export to Excel" (see exportAllToExcel in xlsxExport.ts) is your
//     backup mechanism — export regularly if this data matters to you.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { generateId } from "@/lib/id";

const STORAGE_PREFIX = "ipo-fund-dashboard:";

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(items));
}

/**
 * React hook giving a page CRUD access to one localStorage-backed entity
 * list, with an API shaped like the old useSWR + apiRequest pattern so page
 * components needed minimal changes: { items, isLoading, create, update,
 * remove, replaceAll }.
 */
export function useLocalEntities<T extends { id: string }>(key: string, idPrefix: string, seed: T[] = []) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const existing = readList<T>(key);
    if (existing.length === 0 && seed.length > 0) {
      writeList(key, seed);
      setItems(seed);
    } else {
      setItems(existing);
    }
    setIsLoading(false);
    // Only seed/read once on mount — `seed` is a stable module-level constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback(
    (next: T[]) => {
      setItems(next);
      writeList(key, next);
    },
    [key]
  );

  const create = useCallback(
    (input: Omit<T, "id">) => {
      const item = { ...input, id: generateId(idPrefix) } as T;
      persist([item, ...readList<T>(key)]);
      return item;
    },
    [key, idPrefix, persist]
  );

  const update = useCallback(
    (id: string, patch: Partial<T>) => {
      const next = readList<T>(key).map((i) => (i.id === id ? { ...i, ...patch } : i));
      persist(next);
    },
    [key, persist]
  );

  const remove = useCallback(
    (id: string) => {
      persist(readList<T>(key).filter((i) => i.id !== id));
    },
    [key, persist]
  );

  /** Replaces the entire list — used by IPO sync/import to merge in bulk. */
  const replaceAll = useCallback(
    (next: T[]) => {
      persist(next);
    },
    [persist]
  );

  return { items, isLoading, create, update, remove, replaceAll, refresh: () => setItems(readList<T>(key)) };
}

export const STORAGE_KEYS = {
  ipos: "ipos",
  applications: "applications",
  funds: "funds",
  investors: "investors",
} as const;

/** Direct (non-hook) read — used by the dashboard summary and the Excel export, which need all four lists at once. */
export function readAllEntities<T>(key: string): T[] {
  return readList<T>(key);
}
