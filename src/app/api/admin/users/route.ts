import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listUsers } from "@/lib/repositories/users";

export async function GET() {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;
  const users = await listUsers();
  return NextResponse.json({ users });
}
