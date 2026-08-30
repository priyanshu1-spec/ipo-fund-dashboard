import { ensureSchema, sql } from "@/lib/db";
import { generateId } from "@/lib/id";
import type { MarketHolidayRecord } from "@/types";

export type { MarketHolidayRecord };

function toHoliday(r: Record<string, unknown>): MarketHolidayRecord {
  return {
    id: String(r.id ?? ""),
    date: String(r.holiday_date ?? ""),
    description: String(r.description ?? ""),
    createdAt: String(r.created_at ?? ""),
    createdBy: String(r.created_by ?? ""),
  };
}

export async function listMarketHolidays(): Promise<MarketHolidayRecord[]> {
  await ensureSchema();
  const { rows } = await sql`SELECT * FROM market_holidays ORDER BY holiday_date ASC`;
  return rows.map(toHoliday);
}

/** Just the ISO date strings, as a Set — the shape ipoTimeline.ts's estimator actually needs to skip a date in O(1). */
export async function listMarketHolidayDates(): Promise<Set<string>> {
  const holidays = await listMarketHolidays();
  return new Set(holidays.map((h) => h.date));
}

export async function addMarketHoliday(date: string, description: string, createdBy: string): Promise<MarketHolidayRecord> {
  await ensureSchema();
  const now = new Date().toISOString();
  const id = generateId("holiday");
  const { rows } = await sql`
    INSERT INTO market_holidays (id, holiday_date, description, created_at, created_by)
    VALUES (${id}, ${date}, ${description}, ${now}, ${createdBy})
    ON CONFLICT (holiday_date) DO UPDATE SET description = EXCLUDED.description
    RETURNING *
  `;
  return toHoliday(rows[0]);
}

export async function deleteMarketHoliday(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM market_holidays WHERE id = ${id}`;
}
