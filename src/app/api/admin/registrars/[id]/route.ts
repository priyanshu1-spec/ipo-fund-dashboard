import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { deleteRegistrar, setRegistrarUrl } from "@/lib/repositories/registrars";
import { recordActivity } from "@/lib/repositories/activityLog";

const patchSchema = z.object({
  allotmentUrl: z.string().trim().url("Enter a valid URL (must start with https://)"),
  verified: z.boolean().optional().default(true),
});

/** Admin sets/edits a registrar's official allotment-status page. This is the ONLY way a registrar's "Check Allotment" link becomes clickable for users — never auto-filled, never guessed (see repositories/registrars.ts). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.allotmentUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Allotment URL must use https://" }, { status: 400 });
  }

  try {
    const registrar = await setRegistrarUrl(params.id, parsed.data.allotmentUrl, parsed.data.verified, auth.actor);
    await recordActivity({
      userId: auth.userId,
      userName: auth.actor,
      action: "update",
      entityType: "registrar",
      entityId: registrar.id,
      entityLabel: registrar.displayName || registrar.matchKey,
      details: `allotment URL set -> ${registrar.allotmentUrl}`,
    });
    return NextResponse.json({ registrar });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 404 }
    );
  }
}

/** Removes a registrar entry — e.g. a duplicate auto-detected spelling of one already verified under a different match_key. Existing IPOs aren't touched (registrar matching is resolved at read time, not stored per-row), so this just means those IPOs' allotment link falls back to "unavailable" until re-added. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  await deleteRegistrar(params.id);
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "delete",
    entityType: "registrar",
    entityId: params.id,
    entityLabel: params.id,
  });
  return NextResponse.json({ ok: true });
}
