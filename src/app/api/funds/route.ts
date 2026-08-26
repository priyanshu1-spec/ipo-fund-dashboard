import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { createFundAllocation, listFundAllocations } from "@/lib/repositories/funds";

const fundInputSchema = z.object({
  applicationId: z.string().min(1),
  ipoName: z.string().min(1),
  investorId: z.string().min(1),
  investorName: z.string().min(1),
  source: z.enum(["Self", "Third-Party"]),
  amountContributed: z.number().nonnegative(),
  dateReceived: z.string().optional().default(""),
  repaymentBankAccount: z.string().optional().default(""),
  amountRepaid: z.number().nonnegative().optional().default(0),
  repaymentDate: z.string().optional().default(""),
  profitShareAmount: z.number().optional().default(0),
  profitShareStatus: z.enum(["N/A", "Pending", "Settled"]).optional().default("N/A"),
  notes: z.string().optional().default(""),
});

export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const funds = await listFundAllocations();
  return NextResponse.json({ funds });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = fundInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const fund = await createFundAllocation(parsed.data);
  return NextResponse.json({ fund }, { status: 201 });
}
