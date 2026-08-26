import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listIpos } from "@/lib/repositories/ipos";

export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const ipos = (await listIpos()).filter((i) => i.status === "Open");
  return NextResponse.json({ ipos });
}
