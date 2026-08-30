import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteMarketHoliday } from "@/lib/repositories/marketHolidays";
import { recordActivity } from "@/lib/repositories/activityLog";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  await deleteMarketHoliday(params.id);
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "delete",
    entityType: "market_holiday",
    entityId: params.id,
    entityLabel: params.id,
  });
  return NextResponse.json({ ok: true });
}
