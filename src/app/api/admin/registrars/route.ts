import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listRegistrars } from "@/lib/repositories/registrars";

export async function GET() {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const registrars = await listRegistrars();
  return NextResponse.json({ registrars });
}
