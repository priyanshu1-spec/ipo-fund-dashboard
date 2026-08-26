import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteIpo, getIpo, updateIpo } from "@/lib/repositories/ipos";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const ipo = await getIpo(params.id);
  if (!ipo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ipo });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  const patch = await req.json();
  try {
    const ipo = await updateIpo(params.id, patch);
    return NextResponse.json({ ipo });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;
  await deleteIpo(params.id);
  return NextResponse.json({ ok: true });
}
