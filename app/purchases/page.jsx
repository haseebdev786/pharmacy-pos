// SAVE AS: pharmacy-pos/app/purchases/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";

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
          <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
            <p className="mt-1 text-sm text-gray-500">
              Goods-received notes: stock received, what was paid, what is due.
            </p>
          </div>
          <Link
            href="/purchases/new"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            New purchase
          </Link>
        </div>

        <form
          method="get"
          className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
        >
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Supplier</span>
            <select
              name="supplierId"
              defaultValue={supplierId}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
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
            <span className="font-medium text-gray-900">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Filter
          </button>
          {hasFilter ? (
            <a
              href="/purchases"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Clear
            </a>
          ) : null}
        </form>

        {purchases.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            {hasFilter
              ? "No purchases match these filters."
              : "No purchases yet. Record your first goods-received note."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Items</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/purchases/${p.id}`}
                        className="font-medium text-gray-900 underline-offset-2 hover:underline"
                      >
                        {formatDate(p.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.supplier.name}</td>
                    <td className="px-4 py-3 text-gray-600">{p.invoiceNo || "-"}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatPKR(p.total)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatPKR(p.paid)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        p.due > 0 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {formatPKR(p.due)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.status}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p._count.items}</td>
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
