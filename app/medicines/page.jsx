// SAVE AS: pharmacy-pos/app/medicines/page.jsx
// Medicine list: any signed-in user. Server-side search by name,
// generic name, barcode or SKU. Shows active and inactive medicines
// (with their status) so a deactivated medicine can be found again
// and reactivated. "Add medicine" is shown to pharmacist+ only; the
// API enforces the role regardless of what the UI shows.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatDate, daysToExpiry } from "@/lib/format";
import AppShell from "@/components/AppShell";

export const instant = false;

function expiryStatus(batch, warningDays) {
  if (!batch) return { label: "No stock", className: "bg-gray-100 text-gray-600" };
  const days = daysToExpiry(batch.expiryDate);
  if (days < 0) {
    return { label: "Expired", className: "bg-red-100 text-red-700" };
  }
  if (days <= warningDays) {
    return { label: "Expiring soon", className: "bg-amber-100 text-amber-700" };
  }
  return { label: "OK", className: "bg-green-100 text-green-700" };
}

export default async function MedicinesPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = hasRole(user, ["admin", "pharmacist"]);

  const resolved = await searchParams;
  const term = String(resolved?.q ?? "").trim();

  // SQLite note: plain `contains` uses LIKE, which is case-insensitive
  // for ASCII — no `mode: "insensitive"` (unsupported on SQLite).
  const where = term
    ? {
        OR: [
          { name: { contains: term } },
          { genericName: { contains: term } },
          { barcode: { contains: term } },
          { sku: { contains: term } },
        ],
      }
    : {};

  const [medicines, settings] = await Promise.all([
    prisma.medicine.findMany({
      where,
      include: {
        batches: {
          select: {
            id: true,
            batchNo: true,
            expiryDate: true,
            quantity: true,
            salePrice: true,
            purchasePrice: true,
          },
          orderBy: { expiryDate: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);
  const warningDays = settings?.expiryWarningDays ?? 90;

  const rows = medicines.map((m) => {
    const totalStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
    // Soonest expiry among batches that still hold stock; empty and
    // expired-empty batches do not count.
    const soonest = m.batches
      .filter((b) => b.quantity > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
    return {
      ...m,
      totalStock,
      soonest: soonest ?? null,
      lowStock: totalStock <= m.reorderLevel,
      status: expiryStatus(soonest ?? null, warningDays),
    };
  });

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Medicines</h1>
            <p className="mt-1 text-sm text-gray-500">
              {rows.length} {rows.length === 1 ? "medicine" : "medicines"}
              {term ? (
                <>
                  {" "}
                  matching &ldquo;{term}&rdquo;
                </>
              ) : null}
            </p>
          </div>
          {canManage ? (
            <Link
              href="/medicines/new"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Add medicine
            </Link>
          ) : null}
        </div>

        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={term}
            placeholder="Search name, generic, barcode, SKU"
            className="w-full max-w-md rounded-lg bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-300"
          />
          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 ring-1 ring-gray-300"
          >
            Search
          </button>
          {term ? (
            <Link
              href="/medicines"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 ring-1 ring-gray-300"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">
              {term
                ? "No medicines match this search."
                : "No medicines yet. Add your first medicine to start building stock."}
            </p>
            {!term && canManage ? (
              <Link
                href="/medicines/new"
                className="mt-3 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                Add medicine
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3">Form</th>
                  <th className="px-4 py-3">Total stock</th>
                  <th className="px-4 py-3">Reorder level</th>
                  <th className="px-4 py-3">Soonest expiry</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/medicines/${m.id}`}
                        className="font-medium text-gray-900 underline-offset-2 hover:underline"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {[m.genericName, m.strength].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.form}</td>
                    <td className="px-4 py-3">
                      <span className={m.lowStock ? "font-semibold text-red-600" : "text-gray-900"}>
                        {m.totalStock}
                      </span>
                      {m.lowStock ? (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Low
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.reorderLevel}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {m.soonest ? formatDate(m.soonest.expiryDate) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status.className}`}
                      >
                        {m.status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {m.isActive ? "Yes" : "No"}
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
