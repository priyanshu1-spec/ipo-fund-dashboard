"use client";

import * as XLSX from "xlsx";
import { readAllEntities, STORAGE_KEYS } from "@/lib/localStorage";
import { buildInvestorLedgers } from "@/lib/calculations";
import type { ApplicationRow, FundAllocationRow, InvestorRow, IpoRow } from "@/types";

/** Exports everything in this browser's localStorage as a multi-sheet .xlsx download — the backup mechanism, since there's no server-side database. */
export function exportAllToExcel() {
  const ipos = readAllEntities<IpoRow>(STORAGE_KEYS.ipos);
  const applications = readAllEntities<ApplicationRow>(STORAGE_KEYS.applications);
  const funds = readAllEntities<FundAllocationRow>(STORAGE_KEYS.funds);
  const investors = readAllEntities<InvestorRow>(STORAGE_KEYS.investors);
  const ledgers = buildInvestorLedgers(investors, applications, funds, ipos);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ipos), "IPOs");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(applications), "Applications");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(funds), "Fund Allocation");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(investors), "Investors");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ledgers), "Investor Ledger");

  XLSX.writeFile(workbook, `ipo-fund-dashboard-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
