// SAVE AS: pharmacy-pos/app/purchases/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";
import { PageHeader, Badge, Icon } from "@/components/ui.jsx";

export const instant = false;

const PHARMACIST_PLUS = ["admin", "pharmacist"];

export default async function PurchasesPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, PHARMACIST_PLUS)) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <PageHeader title="Purchases" />
          <p className="card card-pad text-sm text-slate-600">
            Access denied. Only pharmacists and admins can view purchases.
          </p>
        </div>
      </AppShell>
    );
  }

  const sp = await searchParams;
  const supplierId = typeof sp?.supplierId === "string" ? sp.supplierId : "";
  const from = typeof sp?.from === "string" ? sp.from : "";
  const to = typeof sp?.to === "string" ? sp.to : "";

  const where = {};
  if (supplierId) where.supplierId = supplierId;
  const dateFilter = {};
  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
  }
  if (to) {
    const toDate = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(toDate.getTime())) dateFilter.lte = toDate;
  }
  if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

  const [suppliers, purchases] = await Promise.all([
    prisma.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    }),
  ]);

  const hasFilter = Boolean(supplierId || from || to);

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <PageHeader
          title="Purchases"
          description="Goods-received notes: stock received, what was paid, what is due."
          actions={
            <Link href="/purchases/new" className="btn btn-primary">
              <Icon name="plus" className="h-4 w-4" />
              New purchase
            </Link>
          }
        />

        <form
          method="get"
          className="card card-pad flex flex-wrap items-end gap-2"
        >
          <label className="block text-sm">
            <span className="label">Supplier</span>
            <select
              name="supplierId"
              defaultValue={supplierId}
              className="input"
            >
              <option value="">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="input"
            />
          </label>
          <label className="block text-sm">
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
          {hasFilter ? (
            <a
              href="/purchases"
              className="btn btn-secondary"
            >
              Clear
            </a>
          ) : null}
        </form>

        {purchases.length === 0 ? (
          <p className="card card-pad text-sm text-slate-600">
            {hasFilter
              ? "No purchases match these filters."
              : "No purchases yet. Record your first goods-received note."}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Invoice</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Due</th>
                  <th>Status</th>
                  <th className="text-right">Items</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/purchases/${p.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {formatDate(p.date)}
                      </Link>
                    </td>
                    <td className="text-slate-600">{p.supplier.name}</td>
                    <td className="text-slate-600">{p.invoiceNo || "-"}</td>
                    <td className="text-right text-slate-900">{formatPKR(p.total)}</td>
                    <td className="text-right text-slate-900">{formatPKR(p.paid)}</td>
                    <td
                      className={`text-right font-medium ${
                        p.due > 0 ? "text-red-600" : "text-slate-900"
                      }`}
                    >
                      {formatPKR(p.due)}
                    </td>
                    <td>
                      <Badge tone={p.status === "received" ? "green" : p.status === "partial" ? "amber" : p.status === "returned" ? "amber" : "slate"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="text-right text-slate-600">{p._count.items}</td>
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
