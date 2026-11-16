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
          <h1 className="text-2xl font-bold text-gray-900">Medicine not found</h1>
          <p className="text-sm text-gray-500">
            There is no medicine with this id. It may have been removed, or
            the link is wrong.
          </p>
          <Link
            href="/medicines"
            className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 ring-1 ring-gray-300"
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
            <Link href="/medicines" className="text-sm text-gray-500 hover:underline">
              Back to medicines
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{medicine.name}</h1>
            <p className="mt-1 flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {medicine.form}
              </span>
              {medicine.requiresPrescription ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Prescription required
                </span>
              ) : null}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  medicine.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {medicine.isActive ? "Active" : "Inactive"}
              </span>
              {totalStock <= medicine.reorderLevel ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Low stock
                </span>
              ) : null}
            </p>
          </div>
          {canManage ? (
            <MedicineActions medicineId={medicine.id} isActive={medicine.isActive} />
          ) : null}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="font-semibold text-gray-900">Details</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="font-semibold text-gray-900">Batches</h2>
          {medicine.batches.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No batches yet. Batches arrive with purchases, or can be added
              through the batches API.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-2 py-2">Batch</th>
                    <th className="px-2 py-2">Expiry</th>
                    <th className="px-2 py-2">Quantity</th>
                    <th className="px-2 py-2">Purchase price</th>
                    <th className="px-2 py-2">Sale price</th>
                    <th className="px-2 py-2">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {medicine.batches.map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-2 py-2 font-medium text-gray-900">{b.batchNo}</td>
                      <td className="px-2 py-2 text-gray-700">
                        {formatDate(b.expiryDate)}{" "}
                        <span className="text-xs text-gray-500">({expiryText(b.expiryDate)})</span>
                      </td>
                      <td className="px-2 py-2 text-gray-700">{b.quantity}</td>
                      <td className="px-2 py-2 text-gray-700">{formatPKR(b.purchasePrice)}</td>
                      <td className="px-2 py-2 text-gray-700">{formatPKR(b.salePrice)}</td>
                      <td className="px-2 py-2 text-gray-700">{b.supplier?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canManage ? (
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Edit medicine</h2>
            <MedicineForm medicine={formMedicine} onCancelHref={`/medicines/${medicine.id}`} />
          </div>
        ) : null}

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="font-semibold text-gray-900">Recent stock movements</h2>
          {movements.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No stock movements yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {movements.map((mv) => (
                <li
                  key={mv.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-50 pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="text-gray-700">
                    <span
                      className={`font-medium ${
                        mv.qtyChange >= 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {mv.qtyChange >= 0 ? `+${mv.qtyChange}` : mv.qtyChange}
                    </span>{" "}
                    {mv.type} · batch {mv.batch?.batchNo || "—"}
                    {mv.reason ? <span className="text-gray-500"> · {mv.reason}</span> : null}
                  </span>
                  <span className="text-xs text-gray-500">
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
