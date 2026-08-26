import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listGmpHistory } from "@/lib/repositories/ipos";

/** GMP history for one IPO — always unofficial/market-indicative data, see docs/SCHEMA.md. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const history = await listGmpHistory(params.id);
  return NextResponse.json({ history });
}
