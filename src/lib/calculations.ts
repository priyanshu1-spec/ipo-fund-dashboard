import type {
  ApplicationRow,
  DashboardSummary,
  FundAllocationRow,
  InvestorLedgerSummary,
  InvestorRow,
  IpoRow,
} from "@/types";

/** Estimated listing gain for one application, using live GMP when not yet listed. */
export function estimateApplicationProfit(app: ApplicationRow, ipo: IpoRow | undefined): number {
  if (app.allotmentStatus !== "Allotted" && app.allotmentStatus !== "Partial") return 0;
  const shares = app.lotsAllotted * (ipo?.lotSize ?? 0);
  if (shares <= 0) return 0;

  // Once actually sold, realised P&L is authoritative.
  if (app.sellPrice > 0) {
    const perShareCost = app.amountAllotted > 0 ? app.amountAllotted / shares : ipo?.priceBandMax ?? 0;
    return (app.sellPrice - perShareCost) * shares;
  }

  const issuePrice = ipo?.priceBandMax ?? 0;
  if (ipo?.status === "Listed" && ipo.listingPrice != null) {
    return (ipo.listingPrice - issuePrice) * shares;
  }
  // Still unlisted: estimate using GMP (grey market premium per share).
  return (ipo?.gmp ?? 0) * shares;
}

export function buildInvestorLedgers(
  investors: InvestorRow[],
  applications: ApplicationRow[],
  funds: FundAllocationRow[],
  ipos: IpoRow[]
): InvestorLedgerSummary[] {
  const ipoById = new Map(ipos.map((i) => [i.id, i]));
  const appById = new Map(applications.map((a) => [a.id, a]));

  return investors.map((investor) => {
    const myFunds = funds.filter((f) => f.investorId === investor.id);
    const totalProvided = myFunds.reduce((s, f) => s + f.amountContributed, 0);
    const totalRepaid = myFunds.reduce((s, f) => s + f.amountRepaid, 0);
    const totalRefunded = myFunds.reduce((s, f) => {
      const app = appById.get(f.applicationId);
      if (!app) return s;
      const share = f.amountContributed / (app.amountBlocked || f.amountContributed || 1);
      return s + app.refundAmount * share;
    }, 0);
    const totalAllotmentValue = myFunds.reduce((s, f) => {
      const app = appById.get(f.applicationId);
      if (!app) return s;
      const share = f.amountContributed / (app.amountBlocked || f.amountContributed || 1);
      return s + app.amountAllotted * share;
    }, 0);
    const netProfitShare = myFunds.reduce((s, f) => s + f.profitShareAmount, 0);
    const totalBlocked = myFunds.reduce((s, f) => {
      const app = appById.get(f.applicationId);
      if (!app) return s;
      // Blocked = contributed minus whatever has already been refunded/allotted-out.
      return s + f.amountContributed;
    }, 0);

    return {
      investorId: investor.id,
      investorName: investor.name,
      totalProvided,
      totalBlocked,
      totalRefunded,
      totalAllotmentValue,
      totalRepaid,
      netProfitShare,
      outstandingToRepay: Math.max(0, totalProvided - totalRepaid),
    };
  });
}

export function buildDashboardSummary(
  ipos: IpoRow[],
  applications: ApplicationRow[],
  funds: FundAllocationRow[],
  investors: InvestorRow[]
): DashboardSummary {
  const ipoById = new Map(ipos.map((i) => [i.id, i]));
  const activeStatuses = new Set(["Upcoming", "Open", "Closed", "Allotment Awaited"]);

  const activeApplications = applications.filter((a) => {
    const ipo = ipoById.get(a.ipoId);
    return ipo ? activeStatuses.has(ipo.status) : false;
  });

  const totalBlockedCapital = applications
    .filter((a) => a.allotmentStatus === "Pending" || a.allotmentStatus === "Partial")
    .reduce((s, a) => s + a.amountBlocked, 0);

  const totalSelfCapital = funds
    .filter((f) => f.source === "Self")
    .reduce((s, f) => s + f.amountContributed, 0);
  const totalThirdPartyCapital = funds
    .filter((f) => f.source === "Third-Party")
    .reduce((s, f) => s + f.amountContributed, 0);

  const pendingAllotments = applications.filter((a) => a.allotmentStatus === "Pending").length;

  const estimatedProfitFromGmp = applications.reduce(
    (s, a) => s + estimateApplicationProfit(a, ipoById.get(a.ipoId)),
    0
  );

  const upcomingIpoCount = ipos.filter((i) => i.status === "Upcoming").length;
  const openIpoCount = ipos.filter((i) => i.status === "Open").length;

  const investorLedgers = buildInvestorLedgers(investors, applications, funds, ipos);

  const monthlyPnlMap = new Map<string, number>();
  for (const a of applications) {
    if (!a.sellDate) continue;
    const month = a.sellDate.slice(0, 7); // yyyy-MM
    const profit = estimateApplicationProfit(a, ipoById.get(a.ipoId));
    monthlyPnlMap.set(month, (monthlyPnlMap.get(month) ?? 0) + profit);
  }
  const monthlyPnl = Array.from(monthlyPnlMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, profit]) => ({ month, profit }));

  return {
    totalActiveBids: activeApplications.length,
    totalBlockedCapital,
    totalSelfCapital,
    totalThirdPartyCapital,
    pendingAllotments,
    estimatedProfitFromGmp,
    upcomingIpoCount,
    openIpoCount,
    investorLedgers,
    monthlyPnl,
  };
}
