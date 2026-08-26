import { NextResponse } from "next/server";
import { isAuthedContext, requireApiAuth } from "@/lib/apiAuth";
import { listIpos } from "@/lib/repositories/ipos";
import { listApplications } from "@/lib/repositories/applications";
import { listFundAllocations } from "@/lib/repositories/funds";
import { listInvestors } from "@/lib/repositories/investors";
import { buildDashboardSummary } from "@/lib/calculations";
import { findDuplicatePanWarnings } from "@/lib/duplicatePan";

export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;

  const [ipos, applications, funds, investors] = await Promise.all([
    listIpos(),
    listApplications(),
    listFundAllocations(),
    listInvestors(),
  ]);

  const summary = buildDashboardSummary(ipos, applications, funds, investors);
  const duplicatePanWarnings = findDuplicatePanWarnings(applications);

  return NextResponse.json({ summary, duplicatePanWarnings });
}
