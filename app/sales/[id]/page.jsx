// SAVE AS: pharmacy-pos/app/sales/[id]/page.jsx
// Sale detail: full bill, items with batch + expiry, payment info and
// returns. ReturnForm and VoidSaleButton are built by Phase 4 and are
// imported here by their frozen contracts — ReturnForm only for
// pharmacist+, VoidSaleButton only for admin, both hidden once voided.
// Cashiers may only view their own sales.
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ReturnForm from "@/components/ReturnForm";
import VoidSaleButton from "@/components/VoidSaleButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";

export const instant = false;

export default async function SaleDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const [sale, settingRow] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            medicine: { select: { name: true, unit: true, unitsPerStrip: true } },
            batch: { select: { batchNo: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
        cashier: { select: { id: true, name: true } },
        returns: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                medicine: { select: { name: true } },
                batch: { select: { batchNo: true } },
              },
            },
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);
  const currency = settingRow?.currency || "Rs";
  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!sale) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
            Sale not found.
          </p>
          <Link href="/sales" className="text-sm font-medium text-blue-600 hover:underline">
            Back to sales
          </Link>
        </div>
      </AppShell>
    );
  }

  if (user.role === "cashier" && sale.cashierId !== user.id) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <p className="rounded-2xl bg-white p-5 text-sm font-medium text-red-600 shadow-sm ring-1 ring-gray-100">
            Access denied: cashiers can only view their own sales.
          </p>
          <Link href="/sales" className="text-sm font-medium text-blue-600 hover:underline">
            Back to sales
          </Link>
        </div>
      </AppShell>
    );
  }

  // Returned quantity per sale item, grouped in JS from ReturnItem rows.
  const itemIds = sale.items.map((item) => item.id);
  const returnItems =
    itemIds.length > 0
      ? await prisma.returnItem.findMany({
          where: { saleItemId: { in: itemIds } },
          select: { saleItemId: true, qtyBaseUnits: true },
        })
      : [];
  const returnedByItem = new Map();
  for (const ri of returnItems) {
    returnedByItem.set(ri.saleItemId, (returnedByItem.get(ri.saleItemId) || 0) + ri.qtyBaseUnits);
  }

  // Plain object for ReturnForm (frozen Phase 4 contract: Dates as ISO strings).
  const salePlain = {
    id: sale.id,
    billNo: sale.billNo,
    status: sale.status,
    paymentMethod: sale.paymentMethod,
    grandTotal: sale.grandTotal,
    items: sale.items.map((item) => ({
      id: item.id,
      medicineId: item.medicineId,
      medicineName: item.medicine.name,
      batchId: item.batchId,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate.toISOString(),
      qtyBaseUnits: item.qtyBaseUnits,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: item.total,
      returnedQty: returnedByItem.get(item.id) || 0,
    })),
  };

  const isVoided = sale.status === "voided";
  const canReturn = hasRole(user, ["admin", "pharmacist"]) && !isVoided;
  const canVoid = hasRole(user, ["admin"]) && !isVoided;

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bill {sale.billNo}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {formatDate(sale.createdAt)} · Status:{" "}
              <span className="font-medium text-gray-900">{sale.status}</span>
            </p>
          </div>
          <Link
            href={`/sales/${sale.id}/receipt`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View / print receipt
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-gray-100">
            <h2 className="font-semibold text-gray-900">Customer</h2>
            <p className="mt-1">{sale.customer?.name || "Walk-in"}</p>
            {sale.customer?.phone && <p className="text-gray-500">{sale.customer.phone}</p>}
            {sale.prescriptionRef && (
              <p className="mt-2 text-gray-500">Prescription ref: {sale.prescriptionRef}</p>
            )}
            {sale.doctorName && <p className="text-gray-500">Doctor: {sale.doctorName}</p>}
          </div>
          <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-gray-100">
            <h2 className="font-semibold text-gray-900">Payment</h2>
            <p className="mt-1">Method: {sale.paymentMethod}</p>
            <p className="text-gray-500">Cashier: {sale.cashier?.name || "-"}</p>
            <p className="text-gray-500">
              Received: {formatPKR(sale.amountReceived, currency)} · Change:{" "}
              {formatPKR(sale.changeDue, currency)}
            </p>
            {sale.creditAmount > 0 && (
              <p className="text-gray-500">Credit (Udhaar): {formatPKR(sale.creditAmount, currency)}</p>
            )}
            {sale.voidReason && (
              <p className="mt-2 font-medium text-red-600">Void reason: {sale.voidReason}</p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Medicine</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 text-right font-medium">Discount</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Returned</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.medicine.name}</td>
                  <td className="px-4 py-3">{item.batchNo}</td>
                  <td className="px-4 py-3">{formatDate(item.expiryDate)}</td>
                  <td className="px-4 py-3">
                    {item.qtyDisplay} {item.displayUnit} ({item.qtyBaseUnits} unit(s))
                  </td>
                  <td className="px-4 py-3 text-right">{formatPKR(item.unitPrice, currency)}/unit</td>
                  <td className="px-4 py-3 text-right">{formatPKR(item.discount, currency)}</td>
                  <td className="px-4 py-3 text-right">{formatPKR(item.total, currency)}</td>
                  <td className="px-4 py-3">{returnedByItem.get(item.id) || 0} unit(s)</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 px-4 py-3 text-right text-sm">
            <p>Subtotal: {formatPKR(sale.subtotal, currency)}</p>
            <p>Bill discount: {formatPKR(sale.discount, currency)}</p>
            <p>Tax: {formatPKR(sale.tax, currency)}</p>
            <p className="text-base font-semibold">
              Grand total: {formatPKR(sale.grandTotal, currency)}
            </p>
          </div>
        </div>

        {sale.returns.length > 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <h2 className="font-semibold text-gray-900">Returns</h2>
            <ul className="mt-2 space-y-3">
              {sale.returns.map((ret) => (
                <li key={ret.id} className="border-b border-gray-100 pb-3 text-sm last:border-0 last:pb-0">
                  <p>
                    {formatDate(ret.createdAt)} · {ret.reason} · Refund{" "}
                    {formatPKR(ret.refundTotal, currency)} · by {ret.createdBy?.name || "-"}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-gray-500">
                    {ret.items.map((ri) => (
                      <li key={ri.id}>
                        {ri.medicine.name} (batch {ri.batch.batchNo}): {ri.qtyBaseUnits} unit(s) ·{" "}
                        {formatPKR(ri.refundAmount, currency)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canReturn && <ReturnForm sale={salePlain} />}
        {canVoid && (
          <VoidSaleButton saleId={sale.id} billNo={sale.billNo} isVoided={sale.status === "voided"} />
        )}

        <Link href="/sales" className="inline-block text-sm font-medium text-blue-600 hover:underline">
          Back to sales
        </Link>
      </div>
    </AppShell>
  );
}
