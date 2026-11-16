// SAVE AS: pharmacy-pos/app/sales/page.jsx
// Sales history: filter by bill no, payment method and date range.
// Cashiers see only their own sales.
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";
import { PageHeader, Badge, EmptyState, Icon } from "@/components/ui.jsx";


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
        <PageHeader
          title="Sales"
          actions={
            <Link href="/pos" className="btn btn-primary">
              <Icon name="cart" className="h-4 w-4" />
              New bill (POS)
            </Link>
          }
        />

        <form method="get" className="card card-pad flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="label">Bill no</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="BILL-0001"
              className="input"
            />
          </label>
          <label className="text-sm">
            <span className="label">Payment method</span>
            <select
              name="paymentMethod"
              defaultValue={paymentMethod}
              className="input"
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
            <span className="label">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="input"
            />
          </label>
          <label className="text-sm">
            <span className="label">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="input"
            />
          </label>
          <button
            type="submit"
            className="btn btn-secondary"
          >
            Filter
          </button>
          {(q || paymentMethod || from || to) && (
            <Link href="/sales" className="btn btn-secondary">
              Clear filters
            </Link>
          )}
        </form>

        {sales.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No sales found."
          >
            Make a bill from the POS screen and it will appear here.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="tbl min-w-[640px]">
              <thead>
                <tr>
                  <th>Bill no</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Cashier</th>
                  <th>Method</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <Link href={`/sales/${sale.id}`} className="link font-medium">
                        {sale.billNo}
                      </Link>
                    </td>
                    <td>{formatDate(sale.createdAt)}</td>
                    <td>{sale.customer?.name || "Walk-in"}</td>
                    <td>{sale.cashier?.name || "-"}</td>
                    <td>{sale.paymentMethod}</td>
                    <td className="text-right">{formatPKR(sale.grandTotal, currency)}</td>
                    <td>
                      <Badge
                        tone={
                          sale.status === "voided"
                            ? "red"
                            : sale.status === "completed"
                              ? "green"
                              : "amber"
                        }
                      >
                        {sale.status}
                      </Badge>
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
