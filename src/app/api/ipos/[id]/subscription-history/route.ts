import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listSubscriptionHistory } from "@/lib/repositories/ipos";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const history = await listSubscriptionHistory(params.id);
  return NextResponse.json({ history });
}
