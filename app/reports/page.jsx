// SAVE AS: pharmacy-pos/app/reports/page.jsx
// Reports. Admin + pharmacist only; cashiers see an access-denied
// message inside the shell (no data fetched for them). All sections
// come from lib/reports-data.js over the live SQLite database — no
// demo numbers, and empty states say so honestly.
//
// Date range: searchParams `from` / `to` are YYYY-MM-DD days from
// <input type="date">. The range is [from 00:00 local, day after `to`
// 00:00 local) — both chosen days are fully included. Defaults: from is
// 30 days ago, to is today (so the exclusive end is tomorrow midnight).
// The expiry section uses Settings.expiryWarningDays (default 90).
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import PrintButton from "@/components/PrintButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatDate, formatPKR } from "@/lib/format";
import {
  getSalesSummary,
  getProfitReport,
  getTopSelling,
  getExpiryReport,
  getLowStockReport,
  getSupplierDues,
  getCustomerCreditReport,
  getCashierSales,
} from "@/lib/reports-data";

export const instant = false;

const DEFAULT_SETTINGS = {
  currency: "Rs",
  expiryWarningDays: 90,
};

// Local YYYY-MM-DD for a Date (no UTC shift).
function toDayString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parses a YYYY-MM-DD day string to local midnight, or null if invalid.
function parseDay(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-3 font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function ReportsPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, ["admin", "pharmacist"])) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            Access denied. Only Admin and Pharmacist can view reports.
          </p>
        </div>
      </AppShell>
    );
  }

  const params = await searchParams;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const fromDay =
    parseDay(typeof params?.from === "string" ? params.from : "") ?? thirtyDaysAgo;
  const toDay =
    parseDay(typeof params?.to === "string" ? params.to : "") ?? today;
  const toExclusive = new Date(toDay);
  toExclusive.setDate(toExclusive.getDate() + 1);

  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const currency = setting?.currency ?? DEFAULT_SETTINGS.currency;
  const expiryWarningDays =
    setting?.expiryWarningDays ?? DEFAULT_SETTINGS.expiryWarningDays;

  const [
    summary,
    profit,
    topSelling,
    expiry,
    lowStock,
    supplierDues,
    customerCredit,
    cashierSales,
  ] = await Promise.all([
    getSalesSummary(prisma, fromDay, toExclusive),
    getProfitReport(prisma, fromDay, toExclusive),
    getTopSelling(prisma, fromDay, toExclusive, 10),
    getExpiryReport(prisma, expiryWarningDays),
    getLowStockReport(prisma),
    getSupplierDues(prisma),
    getCustomerCreditReport(prisma),
    getCashierSales(prisma, fromDay, toExclusive),
  ]);

  const summaryCards = [
    { label: "Bills", value: String(summary.bills) },
    { label: "Gross sales", value: formatPKR(summary.grossSales, currency) },
    { label: "Discounts", value: formatPKR(summary.discounts, currency) },
    { label: "Tax", value: formatPKR(summary.tax, currency) },
    { label: "Grand total", value: formatPKR(summary.grandTotal, currency) },
    { label: "Items sold (units)", value: String(summary.itemsSold) },
  ];

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="mt-1 text-sm text-gray-500">
              {formatDate(fromDay)} to {formatDate(toDay)} (both days included).
              Voided bills are excluded from all sales figures.
            </p>
          </div>
          <PrintButton label="Print reports" />
        </div>

        <section className="no-print rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">From</span>
              <input
                type="date"
                name="from"
                defaultValue={toDayString(fromDay)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">To</span>
              <input
                type="date"
                name="to"
                defaultValue={toDayString(toDay)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Show reports
            </button>
          </form>
        </section>

        <Section title="Sales summary">
          {summary.bills === 0 ? (
            <p className="text-sm text-gray-500">
              No sales in this period. Bills made in this date range will
              appear here.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {card.label}
                </p>
                <p className="mt-1 font-bold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Profit">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Sales profit
              </p>
              <p className="mt-1 font-bold text-gray-900">
                {formatPKR(profit.salesProfit, currency)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Sale price minus purchase cost, minus bill discounts.
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Expenses
              </p>
              <p className="mt-1 font-bold text-gray-900">
                {formatPKR(profit.expensesTotal, currency)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Expenses dated in this period.
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Net profit
              </p>
              <p className="mt-1 font-bold text-gray-900">
                {formatPKR(profit.netProfit, currency)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Sales profit minus expenses.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Top-selling medicines">
          {topSelling.length === 0 ? (
            <p className="text-sm text-gray-500">
              No sales in this period, so there is no top-selling list yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Medicine</th>
                    <th className="py-2 pr-3 text-right">Units sold</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topSelling.map((row) => (
                    <tr key={row.medicineId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.medicineName}</td>
                      <td className="py-2 pr-3 text-right">{row.qtyBaseUnits}</td>
                      <td className="py-2 text-right">
                        {formatPKR(row.revenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Cashier-wise sales">
          {cashierSales.length === 0 ? (
            <p className="text-sm text-gray-500">
              No sales in this period, so there is no cashier breakdown yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Cashier</th>
                    <th className="py-2 pr-3 text-right">Bills</th>
                    <th className="py-2 text-right">Grand total</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierSales.map((row) => (
                    <tr key={row.cashierId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.cashierName}</td>
                      <td className="py-2 pr-3 text-right">{row.bills}</td>
                      <td className="py-2 text-right">
                        {formatPKR(row.grandTotal, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title={`Expiry report (warning window: ${expiryWarningDays} days)`}
        >
          <h3 className="text-sm font-semibold text-gray-900">Expired stock</h3>
          {expiry.expired.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              No expired batches with stock. Expired batches can never be sold.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Medicine</th>
                    <th className="py-2 pr-3">Batch</th>
                    <th className="py-2 pr-3">Expiry</th>
                    <th className="py-2 text-right">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {expiry.expired.map((row) => (
                    <tr key={row.batchId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.medicineName}</td>
                      <td className="py-2 pr-3">{row.batchNo}</td>
                      <td className="py-2 pr-3 text-red-600">
                        {formatDate(row.expiryDate)}
                      </td>
                      <td className="py-2 text-right">{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            Expiring within {expiryWarningDays} days
          </h3>
          {expiry.expiring.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              No batches with stock expire within the next {expiryWarningDays}{" "}
              days. Change the warning window in Settings.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Medicine</th>
                    <th className="py-2 pr-3">Batch</th>
                    <th className="py-2 pr-3">Expiry</th>
                    <th className="py-2 text-right">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {expiry.expiring.map((row) => (
                    <tr key={row.batchId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.medicineName}</td>
                      <td className="py-2 pr-3">{row.batchNo}</td>
                      <td className="py-2 pr-3">{formatDate(row.expiryDate)}</td>
                      <td className="py-2 text-right">{row.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Low stock">
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-500">
              No active medicine is at or below its reorder level.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Medicine</th>
                    <th className="py-2 pr-3 text-right">Total stock (units)</th>
                    <th className="py-2 text-right">Reorder level</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((row) => (
                    <tr key={row.medicineId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pr-3 text-right">{row.totalStock}</td>
                      <td className="py-2 text-right">{row.reorderLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Supplier dues">
          {supplierDues.length === 0 ? (
            <p className="text-sm text-gray-500">
              No supplier is owed anything. Unpaid purchase balances appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Supplier</th>
                    <th className="py-2 pr-3 text-right">Purchases due</th>
                    <th className="py-2 text-right">Total due</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierDues.map((row) => (
                    <tr key={row.supplierId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.supplierName}</td>
                      <td className="py-2 pr-3 text-right">{row.purchaseCount}</td>
                      <td className="py-2 text-right">
                        {formatPKR(row.totalDue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Customer credit (udhaar)">
          {customerCredit.length === 0 ? (
            <p className="text-sm text-gray-500">
              No customer owes anything. Credit-sale balances appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Phone</th>
                    <th className="py-2 text-right">Credit balance</th>
                  </tr>
                </thead>
                <tbody>
                  {customerCredit.map((row) => (
                    <tr key={row.customerId} className="border-b last:border-0">
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pr-3">{row.phone ?? "-"}</td>
                      <td className="py-2 text-right">
                        {formatPKR(row.creditBalance, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
