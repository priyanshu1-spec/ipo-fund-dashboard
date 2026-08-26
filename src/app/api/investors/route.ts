import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { createInvestor, listInvestors } from "@/lib/repositories/investors";

const investorInputSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  defaultBankAccount: z.string().optional().default(""),
  defaultBankIfsc: z.string().optional().default(""),
  demandAccountNumber: z.string().optional().default(""),
  panMasked: z.string().optional().default(""),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
  notes: z.string().optional().default(""),
});

export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;
  const investors = await listInvestors();
  return NextResponse.json({ investors });
}

export async function POST(req: Request) {
  const auth = await requireApiAuth("editor");
  if (!isAuthedContext(auth)) return auth;

  const body = await req.json();
  const parsed = investorInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const investor = await createInvestor(parsed.data);
  return NextResponse.json({ investor }, { status: 201 });
}
