import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { createApplication, listApplications } from "@/lib/repositories/applications";
import { logAudit } from "@/lib/repositories/auditLog";

const applicationInputSchema = z.object({
  ipoId: z.string().min(1),
  ipoName: z.string().min(1),
  appliedInNameOf: z.string().min(1),
  investorId: z.string().min(1),
  panMasked: z.string().optional().default(""),
  applicationNumber: z.string().optional().default(""),
  upiId: z.string().optional().default(""),
  category: z.enum(["Retail", "HNI (sHNI)", "bHNI", "Shareholder", "Employee"]),
  lotsApplied: z.number().nonnegative(),
  amountBlocked: z.number().nonnegative(),
  paymentMode: z.enum(["ASBA", "UPI"]),
  allotmentStatus: z.enum(["Pending", "Allotted", "Not Allotted", "Partial"]).optional().default("Pending"),
  lotsAllotted: z.number().nonnegative().optional().default(0),
  amountAllotted: z.number().nonnegative().optional().default(0),
  refundAmount: z.number().nonnegative().optional().default(0),
  refundStatus: z.enum(["N/A", "Pending", "Received"]).optional().default("N/A"),
  refundDate: z.string().optional().default(""),
  sellDate: z.string().optional().default(""),
  sellPrice: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().default(""),
});

export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const applications = await listApplications();
  return NextResponse.json({ applications });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = applicationInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const application = await createApplication(parsed.data, auth.actor);
  await logAudit(auth.actor, "create", "Application", application.id, application.ipoName);
  return NextResponse.json({ application }, { status: 201 });
}
