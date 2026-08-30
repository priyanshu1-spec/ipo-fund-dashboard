import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { addMarketHoliday, listMarketHolidays } from "@/lib/repositories/marketHolidays";
import { recordActivity } from "@/lib/repositories/activityLog";

export async function GET() {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const holidays = await listMarketHolidays();
  return NextResponse.json({ holidays });
}

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date as yyyy-mm-dd"),
  description: z.string().trim().optional().default(""),
});

/** Admin adds one NSE/BSE trading-holiday date — the ONLY way a date enters the estimator's skip list (see repositories/marketHolidays.ts). Never auto-filled, never guessed. */
export async function POST(req: Request) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const holiday = await addMarketHoliday(parsed.data.date, parsed.data.description, auth.actor);
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "create",
    entityType: "market_holiday",
    entityId: holiday.id,
    entityLabel: holiday.date,
    details: holiday.description,
  });
  return NextResponse.json({ holiday }, { status: 201 });
}
