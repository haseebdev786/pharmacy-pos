// SAVE AS: pharmacy-pos/app/medicines/[id]/page.jsx
// Medicine detail: any signed-in user. Shows details, all batches
// (earliest expiry first), total stock and the 20 most recent stock
// movements. The edit form and deactivate/reactivate actions are
// pharmacist+ only; cashiers see read-only details. A missing
// medicine renders an honest "Medicine not found" message.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate, daysToExpiry } from "@/lib/format";
import AppShell from "@/components/AppShell";
import MedicineForm from "@/components/MedicineForm";
import MedicineActions from "@/components/MedicineActions";
import { Badge, Icon } from "@/components/ui.jsx";

export const instant = false;

function expiryText(expiryDate) {
  const days = daysToExpiry(expiryDate);
  if (days < 0) return `expired ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days === 0) return "expires today";
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

export default async function MedicineDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const canManage = hasRole(user, ["admin", "pharmacist"]);

  const shellUser = { name: user.name, email: user.email, role: user.role };

  const medicine = await prisma.medicine.findUnique({
    where: { id },
    include: {
      batches: {
        orderBy: { expiryDate: "asc" },
        include: { supplier: { select: { id: true, name: true } } },
      },
    },
  });

  if (!medicine) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="page-title">Medicine not found</h1>
          <p className="page-desc">
            There is no medicine with this id. It may have been removed, or
            the link is wrong.
          </p>
          <Link
            href="/medicines"
            className="btn btn-secondary"
          >
            Back to medicines
          </Link>
        </div>
      </AppShell>
    );
  }

  const movements = await prisma.stockMovement.findMany({
    where: { medicineId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      batch: { select: { id: true, batchNo: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const totalStock = medicine.batches.reduce((sum, b) => sum + b.quantity, 0);

  // Plain object only (strings/numbers/booleans, no Dates) for the
  // client form. Empty optionals become "" so the form can edit them;
  // the API turns "" back into null.
  const formMedicine = {
    id: medicine.id,
    name: medicine.name,
    genericName: medicine.genericName ?? "",
    manufacturer: medicine.manufacturer ?? "",
    strength: medicine.strength ?? "",
    form: medicine.form,
    category: medicine.category ?? "",
    unit: medicine.unit,
    unitsPerStrip: medicine.unitsPerStrip,
    barcode: medicine.barcode ?? "",
    sku: medicine.sku ?? "",
    reorderLevel: medicine.reorderLevel,
    requiresPrescription: medicine.requiresPrescription,
  };

  const details = [
    ["Generic name", medicine.genericName || "—"],
    ["Manufacturer", medicine.manufacturer || "—"],
    ["Strength", medicine.strength || "—"],
    ["Form", medicine.form],
    ["Category", medicine.category || "—"],
    ["Sold by", medicine.unit],
    ["Units per " + medicine.unit, String(medicine.unitsPerStrip)],
    ["Barcode", medicine.barcode || "—"],
    ["SKU", medicine.sku || "—"],
    ["Reorder level", `${medicine.reorderLevel} base units`],
    ["Requires prescription", medicine.requiresPrescription ? "Yes" : "No"],
    ["Total stock", `${totalStock} base units`],
  ];

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/medicines" className="link inline-flex items-center gap-1.5 text-sm">
              <Icon name="arrowLeft" className="h-4 w-4" />
              Back to medicines
            </Link>
            <h1 className="page-title mt-1">{medicine.name}</h1>
            <p className="mt-1 flex flex-wrap gap-2">
              <Badge tone="slate">{medicine.form}</Badge>
              {medicine.requiresPrescription ? (
                <Badge tone="amber">Prescription required</Badge>
              ) : null}
              <Badge tone={medicine.isActive ? "green" : "red"}>
                {medicine.isActive ? "Active" : "Inactive"}
              </Badge>
              {totalStock <= medicine.reorderLevel ? (
                <Badge tone="red">Low stock</Badge>
              ) : null}
            </p>
          </div>
          {canManage ? (
            <MedicineActions medicineId={medicine.id} isActive={medicine.isActive} />
          ) : null}
        </div>

        <div className="card card-pad">
          <h2 className="section-title">Details</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card card-pad">
          <h2 className="section-title">Batches</h2>
          {medicine.batches.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No batches yet. Batches arrive with purchases, or can be added
              through the batches API.
            </p>
          ) : (
            <div className="table-wrap mt-3">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Quantity</th>
                    <th>Purchase price</th>
                    <th>Sale price</th>
                    <th>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {medicine.batches.map((b) => (
                    <tr key={b.id}>
                      <td className="font-medium text-slate-900">{b.batchNo}</td>
                      <td className="text-slate-700">
                        {formatDate(b.expiryDate)}{" "}
                        <span className="text-xs text-slate-500">({expiryText(b.expiryDate)})</span>
                      </td>
                      <td className="text-slate-700">{b.quantity}</td>
                      <td className="text-slate-700">{formatPKR(b.purchasePrice)}</td>
                      <td className="text-slate-700">{formatPKR(b.salePrice)}</td>
                      <td className="text-slate-700">{b.supplier?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canManage ? (
          <div>
            <h2 className="section-title mb-3 text-lg">Edit medicine</h2>
            <MedicineForm medicine={formMedicine} onCancelHref={`/medicines/${medicine.id}`} />
          </div>
        ) : null}

        <div className="card card-pad">
          <h2 className="section-title">Recent stock movements</h2>
          {movements.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No stock movements yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {movements.map((mv) => (
                <li
                  key={mv.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-50 pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="text-slate-700">
                    <span
                      className={`font-medium ${
                        mv.qtyChange >= 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {mv.qtyChange >= 0 ? `+${mv.qtyChange}` : mv.qtyChange}
                    </span>{" "}
                    {mv.type} · batch {mv.batch?.batchNo || "—"}
                    {mv.reason ? <span className="text-slate-500"> · {mv.reason}</span> : null}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(mv.createdAt)} · {mv.createdBy?.name || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
