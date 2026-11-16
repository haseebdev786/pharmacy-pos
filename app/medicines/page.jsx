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
import { PageHeader, Badge, EmptyState, Icon } from "@/components/ui.jsx";


function expiryStatus(batch, warningDays) {
  if (!batch) return { label: "No stock", className: "bg-slate-100 text-slate-700" };
  const days = daysToExpiry(batch.expiryDate);
  if (days < 0) {
    return { label: "Expired", className: "bg-red-100 text-red-700" };
  }
  if (days <= warningDays) {
    return { label: "Expiring soon", className: "bg-amber-100 text-amber-800" };
  }
  return { label: "OK", className: "bg-green-100 text-green-800" };
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
        <PageHeader
          title="Medicines"
          description={
            <>
              {rows.length} {rows.length === 1 ? "medicine" : "medicines"}
              {term ? (
                <>
                  {" "}
                  matching &ldquo;{term}&rdquo;
                </>
              ) : null}
            </>
          }
          actions={
            canManage ? (
              <Link href="/medicines/new" className="btn btn-primary">
                <Icon name="plus" className="h-4 w-4" />
                Add medicine
              </Link>
            ) : null
          }
        />

        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={term}
            placeholder="Search name, generic, barcode, SKU"
            className="input max-w-md"
          />
          <button
            type="submit"
            className="btn btn-secondary"
          >
            Search
          </button>
          {term ? (
            <Link
              href="/medicines"
              className="btn btn-secondary"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon="pill"
            title={
              term
                ? "No medicines match this search."
                : "No medicines yet. Add your first medicine to start building stock."
            }
            action={
              !term && canManage ? (
                <Link href="/medicines/new" className="btn btn-primary">
                  <Icon name="plus" className="h-4 w-4" />
                  Add medicine
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Form</th>
                  <th>Total stock</th>
                  <th>Reorder level</th>
                  <th>Soonest expiry</th>
                  <th>Status</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link
                        href={`/medicines/${m.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {m.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {[m.genericName, m.strength].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="text-slate-700">{m.form}</td>
                    <td>
                      <span className={m.lowStock ? "font-semibold text-red-600" : "text-slate-900"}>
                        {m.totalStock}
                      </span>
                      {m.lowStock ? (
                        <Badge tone="red" className="ml-2">
                          Low
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-slate-700">{m.reorderLevel}</td>
                    <td className="text-slate-700">
                      {m.soonest ? formatDate(m.soonest.expiryDate) : "—"}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status.className}`}
                      >
                        {m.status.label}
                      </span>
                    </td>
                    <td className="text-slate-700">
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
