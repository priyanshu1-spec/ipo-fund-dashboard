import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { createIpo, listIpos } from "@/lib/repositories/ipos";
import { logAudit } from "@/lib/repositories/auditLog";

const ipoInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["Mainboard", "SME"]),
  openDate: z.string().optional().default(""),
  closeDate: z.string().optional().default(""),
  allotmentDate: z.string().optional().default(""),
  refundDate: z.string().optional().default(""),
  listingDate: z.string().optional().default(""),
  priceBandMin: z.number().nonnegative().optional().default(0),
  priceBandMax: z.number().nonnegative().optional().default(0),
  lotSize: z.number().nonnegative().optional().default(0),
  issueSize: z.string().optional().default(""),
  status: z
    .enum(["Upcoming", "Open", "Closed", "Allotment Awaited", "Allotted", "Listed"])
    .optional()
    .default("Upcoming"),
  gmp: z.number().optional().default(0),
  exchange: z.string().optional().default(""),
  sourceUrl: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const ipos = await listIpos();
  return NextResponse.json({ ipos });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = ipoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const ipo = await createIpo(parsed.data);
  await logAudit(auth.email, "create", "IPO", ipo.id, ipo.name);
  return NextResponse.json({ ipo }, { status: 201 });
}
