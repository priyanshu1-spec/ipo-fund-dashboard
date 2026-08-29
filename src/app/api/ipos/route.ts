import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { createIpo, listIpos } from "@/lib/repositories/ipos";
import { recordActivity } from "@/lib/repositories/activityLog";

const ipoInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["Mainboard", "SME"]),
  symbol: z.string().optional().default(""),
  issueType: z.string().optional().default(""),
  openDate: z.string().optional().default(""),
  closeDate: z.string().optional().default(""),
  allotmentDate: z.string().optional().default(""),
  refundDate: z.string().optional().default(""),
  listingDate: z.string().optional().default(""),
  priceBandMin: z.number().nonnegative().optional().default(0),
  priceBandMax: z.number().nonnegative().optional().default(0),
  faceValue: z.number().nonnegative().nullable().optional(),
  lotSize: z.number().nonnegative().optional().default(0),
  minInvestment: z.number().nonnegative().nullable().optional(),
  issueSize: z.string().optional().default(""),
  freshIssueSize: z.string().optional().default(""),
  offerForSaleSize: z.string().optional().default(""),
  status: z
    .enum(["Upcoming", "Open", "Closed", "Allotment Awaited", "Allotted", "Listed"])
    .optional()
    .default("Upcoming"),
  registrar: z.string().optional().default(""),
  leadManagers: z.string().optional().default(""),
  gmp: z.number().nullable().optional(),
  listingPrice: z.number().nullable().optional(),
  exchange: z.string().optional().default(""),
  sourceUrl: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

// Manually adding/editing an IPO is always officially "Manual" data — automated
// syncing (which can mark isOfficial/NSE) only ever happens via ipoSync.ts.
export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const ipos = await listIpos();
  return NextResponse.json({ ipos });
}

// IPOs are shared/global — every user sees the same rows, unlike the
// per-user Applications/Funds/Investors — so writing to them is admin-only,
// not "editor". An editor's edits should never be able to change what
// every other user sees.
export async function POST(req: Request) {
  const auth = await requireApiAuth("admin");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = ipoInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const ipo = await createIpo({ ...parsed.data, dataSource: "Manual", isOfficial: false });
  await recordActivity({
    userId: auth.userId,
    userName: auth.actor,
    action: "create",
    entityType: "ipo",
    entityId: ipo.id,
    entityLabel: ipo.name,
  });
  return NextResponse.json({ ipo }, { status: 201 });
}
