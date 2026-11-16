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
import { PageHeader, Badge, Icon } from "@/components/ui.jsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";


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
          <p className="card card-pad text-sm text-slate-500">
            Sale not found.
          </p>
          <Link href="/sales" className="link inline-flex items-center gap-1.5 text-sm">
            <Icon name="arrowLeft" className="h-4 w-4" />
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
          <p className="card card-pad text-sm font-medium text-red-600">
            Access denied: cashiers can only view their own sales.
          </p>
          <Link href="/sales" className="link inline-flex items-center gap-1.5 text-sm">
            <Icon name="arrowLeft" className="h-4 w-4" />
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
        <Link href="/sales" className="link inline-flex items-center gap-1.5 text-sm">
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to sales
        </Link>
        <PageHeader
          title={
            <>
              Bill {sale.billNo}
            </>
          }
          description={
            <>
              {formatDate(sale.createdAt)} · Status:{" "}
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
            </>
          }
          actions={
            <Link
              href={`/sales/${sale.id}/receipt`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              <Icon name="printer" className="h-4 w-4" />
              View / print receipt
            </Link>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card card-pad text-sm">
            <h2 className="section-title">Customer</h2>
            <p className="mt-3 font-medium text-slate-900">{sale.customer?.name || "Walk-in"}</p>
            {sale.customer?.phone && <p className="text-slate-500">{sale.customer.phone}</p>}
            {sale.prescriptionRef && (
              <p className="mt-2 text-slate-500">Prescription ref: {sale.prescriptionRef}</p>
            )}
            {sale.doctorName && <p className="text-slate-500">Doctor: {sale.doctorName}</p>}
          </div>
          <div className="card card-pad text-sm">
            <h2 className="section-title">Payment</h2>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Method:</dt>
                <dd className="text-slate-900">{sale.paymentMethod}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Cashier:</dt>
                <dd className="text-slate-900">{sale.cashier?.name || "-"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Received:</dt>
                <dd className="text-slate-900">{formatPKR(sale.amountReceived, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Change:</dt>
                <dd className="text-slate-900">{formatPKR(sale.changeDue, currency)}</dd>
              </div>
              {sale.creditAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Credit (Udhaar):</dt>
                  <dd className="text-slate-900">{formatPKR(sale.creditAmount, currency)}</dd>
                </div>
              )}
              {sale.voidReason && (
                <div className="flex justify-between gap-3">
                  <dt className="font-medium text-red-600">Void reason:</dt>
                  <dd className="font-medium text-red-600">{sale.voidReason}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="table-wrap">
          <table className="tbl min-w-[640px]">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th>Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Total</th>
                <th>Returned</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-900">{item.medicine.name}</td>
                  <td>{item.batchNo}</td>
                  <td>{formatDate(item.expiryDate)}</td>
                  <td>
                    {item.qtyDisplay} {item.displayUnit} ({item.qtyBaseUnits} unit(s))
                  </td>
                  <td className="text-right">{formatPKR(item.unitPrice, currency)}/unit</td>
                  <td className="text-right">{formatPKR(item.discount, currency)}</td>
                  <td className="text-right">{formatPKR(item.total, currency)}</td>
                  <td>{returnedByItem.get(item.id) || 0} unit(s)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="card card-pad ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Subtotal:</dt>
            <dd className="text-slate-900">{formatPKR(sale.subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Bill discount:</dt>
            <dd className="text-slate-900">{formatPKR(sale.discount, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Tax:</dt>
            <dd className="text-slate-900">{formatPKR(sale.tax, currency)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-base font-semibold">
            <dt className="text-slate-900">Grand total:</dt>
            <dd className="text-slate-900">{formatPKR(sale.grandTotal, currency)}</dd>
          </div>
        </dl>

        {sale.returns.length > 0 && (
          <div className="card card-pad">
            <h2 className="section-title">Returns</h2>
            <ul className="mt-3 space-y-3">
              {sale.returns.map((ret) => (
                <li key={ret.id} className="border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
                  <p>
                    {formatDate(ret.createdAt)} · {ret.reason} · Refund{" "}
                    {formatPKR(ret.refundTotal, currency)} · by {ret.createdBy?.name || "-"}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-slate-500">
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
      </div>
    </AppShell>
  );
}
