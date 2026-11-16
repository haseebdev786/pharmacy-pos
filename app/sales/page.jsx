// SAVE AS: pharmacy-pos/app/sales/page.jsx
// Sales history: filter by bill no, payment method and date range.
// Cashiers see only their own sales.
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";

export const instant = false;

const PAYMENT_METHODS = ["Cash", "Card", "Bank", "JazzCash", "EasyPaisa", "Credit"];

export default async function SalesPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const paymentMethod = typeof sp.paymentMethod === "string" ? sp.paymentMethod : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

  const where = {};
  if (q) where.billNo = { contains: q };
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (user.role === "cashier") where.cashierId = user.id;
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }
  }

  const [sales, settingRow] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settingRow?.currency || "Rs";

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <Link
            href="/pos"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New bill (POS)
          </Link>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <label className="text-sm">
            <span className="font-medium text-gray-900">Bill no</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="BILL-0001"
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-gray-900">Payment method</span>
            <select
              name="paymentMethod"
              defaultValue={paymentMethod}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            >
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-gray-900">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="font-medium text-gray-900">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Filter
          </button>
          {(q || paymentMethod || from || to) && (
            <Link href="/sales" className="py-2 text-sm font-medium text-blue-600 hover:underline">
              Clear filters
            </Link>
          )}
        </form>

        {sales.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
            No sales found. Make a bill from the POS screen and it will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Bill no</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Cashier</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/sales/${sale.id}`} className="font-medium text-blue-600 hover:underline">
                        {sale.billNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatDate(sale.createdAt)}</td>
                    <td className="px-4 py-3">{sale.customer?.name || "Walk-in"}</td>
                    <td className="px-4 py-3">{sale.cashier?.name || "-"}</td>
                    <td className="px-4 py-3">{sale.paymentMethod}</td>
                    <td className="px-4 py-3 text-right">{formatPKR(sale.grandTotal, currency)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          sale.status === "voided"
                            ? "rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                            : sale.status === "completed"
                              ? "rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                              : "rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                        }
                      >
                        {sale.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
