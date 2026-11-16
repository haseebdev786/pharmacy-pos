// SAVE AS: pharmacy-pos/app/inventory/page.jsx
// Stock overview, expiry, low-stock and movements tabs: any signed-in
// user. Tab is chosen by ?tab= (overview | expiry | lowstock |
// movements); an unknown or missing tab shows overview. Expiry and
// low-stock lists use the frozen helpers in lib/inventory-data.js.
// Adjustment forms appear on batch rows for pharmacist+ only; the
// API enforces the role regardless.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate, daysToExpiry } from "@/lib/format";
import {
  getExpiringBatches,
  getExpiredBatches,
  getLowStockMedicines,
} from "@/lib/inventory-data";
import AppShell from "@/components/AppShell";
import AdjustmentForm from "@/components/AdjustmentForm";
import { PageHeader, Badge } from "@/components/ui.jsx";

export const instant = false;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "expiry", label: "Expiry" },
  { key: "lowstock", label: "Low stock" },
  { key: "movements", label: "Movements" },
];

function expiryText(expiryDate) {
  const days = daysToExpiry(expiryDate);
  if (days < 0) return `expired ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "expires today";
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

export default async function InventoryPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = hasRole(user, ["admin", "pharmacist"]);

  const resolved = await searchParams;
  const rawTab = resolved?.tab;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab : "overview";

  // Fetch only what the active tab needs.
  let overviewMedicines = [];
  let expiringBatches = [];
  let expiredBatches = [];
  let lowStockMedicines = [];
  let movements = [];
  let warningDays = 90;

  if (tab === "overview") {
    overviewMedicines = await prisma.medicine.findMany({
      where: { isActive: true },
      include: { batches: { orderBy: { expiryDate: "asc" } } },
      orderBy: { name: "asc" },
    });
  } else if (tab === "expiry") {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } });
    warningDays = settings?.expiryWarningDays ?? 90;
    [expiringBatches, expiredBatches] = await Promise.all([
      getExpiringBatches(prisma, warningDays),
      getExpiredBatches(prisma),
    ]);
  } else if (tab === "lowstock") {
    lowStockMedicines = await getLowStockMedicines(prisma);
  } else if (tab === "movements") {
    movements = await prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        medicine: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNo: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  const overviewRows = overviewMedicines.map((m) => {
    const totalStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
    const soonest = m.batches
      .filter((b) => b.quantity > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
    return { ...m, totalStock, soonest: soonest ?? null };
  });

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }}>
      <div className="space-y-6">
        <PageHeader title="Inventory" />

        <nav className="flex flex-wrap gap-2" aria-label="Inventory tabs">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/inventory?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`btn ${tab === t.key ? "btn-primary" : "btn-secondary"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "overview" ? (
          overviewRows.length === 0 ? (
            <div className="card card-pad">
              <p className="text-sm text-slate-500">No active medicines yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {overviewRows.map((m) => (
                <section
                  key={m.id}
                  className="card card-pad"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-semibold text-slate-900">
                      <Link
                        href={`/medicines/${m.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {m.name}
                      </Link>
                    </h2>
                    <p className="text-sm text-slate-500">
                      Total stock:{" "}
                      <span
                        className={
                          m.totalStock <= m.reorderLevel
                            ? "font-semibold text-red-600"
                            : "font-medium text-slate-900"
                        }
                      >
                        {m.totalStock}
                      </span>{" "}
                      · Reorder level: {m.reorderLevel}{" "}
                      {m.totalStock <= m.reorderLevel ? (
                        <Badge tone="red" className="ml-1">
                          Low stock
                        </Badge>
                      ) : null}{" "}
                      · Soonest expiry:{" "}
                      {m.soonest
                        ? `${formatDate(m.soonest.expiryDate)} (${expiryText(m.soonest.expiryDate)})`
                        : "—"}
                    </p>
                  </div>
                  {m.batches.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No batches recorded.</p>
                  ) : (
                    <div className="table-wrap mt-3">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Batch</th>
                            <th>Expiry</th>
                            <th>Quantity</th>
                            <th>Prices</th>
                            {canManage ? <th>Adjust</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {m.batches.map((b) => (
                            <tr key={b.id}>
                              <td className="font-medium text-slate-900">{b.batchNo}</td>
                              <td className="text-slate-700">
                                {formatDate(b.expiryDate)}{" "}
                                <span className="text-xs text-slate-500">
                                  ({expiryText(b.expiryDate)})
                                </span>
                              </td>
                              <td className="text-slate-700">{b.quantity}</td>
                              <td className="text-slate-700">
                                {formatPKR(b.purchasePrice)} / {formatPKR(b.salePrice)}
                              </td>
                              {canManage ? (
                                <td>
                                  <AdjustmentForm
                                    batchId={b.id}
                                    batchNo={b.batchNo}
                                    currentQuantity={b.quantity}
                                    medicineName={m.name}
                                  />
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )
        ) : null}

        {tab === "expiry" ? (
          <div className="space-y-6">
            <section className="card card-pad">
              <h2 className="font-semibold text-red-700">
                Expired batches ({expiredBatches.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Expired stock can never be sold. Adjust a batch to 0 once it
                is removed or returned, with a reason.
              </p>
              {expiredBatches.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No expired batches with stock.</p>
              ) : (
                <BatchTable batches={expiredBatches} canManage={canManage} />
              )}
            </section>
            <section className="card card-pad">
              <h2 className="font-semibold text-amber-700">
                Expiring within {warningDays} days ({expiringBatches.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Warning window comes from Settings (expiry warning days).
              </p>
              {expiringBatches.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No batches expiring within {warningDays} days.
                </p>
              ) : (
                <BatchTable batches={expiringBatches} canManage={canManage} />
              )}
            </section>
          </div>
        ) : null}

        {tab === "lowstock" ? (
          lowStockMedicines.length === 0 ? (
            <div className="card card-pad">
              <p className="text-sm text-slate-500">
                No low-stock medicines. Every active medicine is above its
                reorder level.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Total stock</th>
                    <th>Reorder level</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockMedicines.map((m) => (
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
                      <td className="font-semibold text-red-600">{m.totalStock}</td>
                      <td className="text-slate-700">{m.reorderLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "movements" ? (
          movements.length === 0 ? (
            <div className="card card-pad">
              <p className="text-sm text-slate-500">No stock movements yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Type</th>
                    <th>Change</th>
                    <th>Reason</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mv) => (
                    <tr key={mv.id}>
                      <td className="text-slate-700">{formatDate(mv.createdAt)}</td>
                      <td>
                        <Link
                          href={`/medicines/${mv.medicineId}`}
                          className="font-medium text-slate-900 underline-offset-2 hover:underline"
                        >
                          {mv.medicine?.name || "—"}
                        </Link>
                      </td>
                      <td className="text-slate-700">{mv.batch?.batchNo || "—"}</td>
                      <td className="text-slate-700">{mv.type}</td>
                      <td
                        className={`font-medium ${
                          mv.qtyChange >= 0 ? "text-green-700" : "text-red-600"
                        }`}
                      >
                        {mv.qtyChange >= 0 ? `+${mv.qtyChange}` : mv.qtyChange}
                      </td>
                      <td className="text-slate-700">{mv.reason || "—"}</td>
                      <td className="text-slate-700">{mv.createdBy?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </div>
    </AppShell>
  );
}

// Batch rows for the expiry tab. Defined in this server file (not a
// client component): it only renders data and the AdjustmentForm.
function BatchTable({ batches, canManage }) {
  return (
    <div className="table-wrap mt-3">
      <table className="tbl">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Expiry</th>
            <th>Quantity</th>
            {canManage ? <th>Adjust</th> : null}
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>
                <Link
                  href={`/medicines/${b.medicineId}`}
                  className="font-medium text-slate-900 underline-offset-2 hover:underline"
                >
                  {b.medicine?.name || "—"}
                </Link>
              </td>
              <td className="font-medium text-slate-900">{b.batchNo}</td>
              <td className="text-slate-700">
                {formatDate(b.expiryDate)}{" "}
                <span className="text-xs text-slate-500">({expiryText(b.expiryDate)})</span>
              </td>
              <td className="text-slate-700">{b.quantity}</td>
              {canManage ? (
                <td>
                  <AdjustmentForm
                    batchId={b.id}
                    batchNo={b.batchNo}
                    currentQuantity={b.quantity}
                    medicineName={b.medicine?.name || "Medicine"}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
