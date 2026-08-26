import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { isAuthedContext, requireApiAuth, scopeFor } from "@/lib/apiAuth";
import { listIpos } from "@/lib/repositories/ipos";
import { listApplications } from "@/lib/repositories/applications";
import { listFundAllocations } from "@/lib/repositories/funds";
import { listInvestors } from "@/lib/repositories/investors";
import { buildInvestorLedgers } from "@/lib/calculations";

/** Exports the full server-side ledger as a multi-sheet .xlsx workbook. */
export async function GET() {
  const auth = await requireApiAuth("viewer");
  if (!isAuthedContext(auth)) return auth;

  const scope = scopeFor(auth);
  const [ipos, applications, funds, investors] = await Promise.all([
    listIpos(),
    listApplications(scope),
    listFundAllocations(scope),
    listInvestors(scope),
  ]);
  const ledgers = buildInvestorLedgers(investors, applications, funds, ipos);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ipos), "IPOs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(applications), "Applications");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(funds), "Fund Allocation");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(investors), "Investors");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ledgers), "Investor Ledger");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ipo-fund-dashboard-export-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
    },
  });
}
