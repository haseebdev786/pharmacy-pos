// SAVE AS: pharmacy-pos/components/Receipt.jsx
// 80mm thermal receipt. Standalone: no shell inside this component.
// Props are plain serialized objects (dates as ISO strings). The
// .receipt / .no-print styles live in app/globals.css.
"use client";

import Link from "next/link";
import { formatPKR, formatDate } from "@/lib/format";

export default function Receipt({ sale, settings }) {
  const currency = settings?.currency || "Rs";
  const when = new Date(sale.createdAt);
  const dateTime =
    when.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="receipt px-2 py-4">
        <div className="text-center">
          <p className="text-base font-bold">{settings?.storeName || "My Pharmacy"}</p>
          {settings?.address ? <p>{settings.address}</p> : null}
          {settings?.phone ? <p>Phone: {settings.phone}</p> : null}
        </div>

        <hr className="my-2 border-dashed border-gray-400" />

        <p>
          <span className="font-semibold">Bill:</span> {sale.billNo}
        </p>
        <p>
          <span className="font-semibold">Date:</span> {dateTime}
        </p>
        <p>
          <span className="font-semibold">Cashier:</span> {sale.cashierName}
        </p>
        <p>
          <span className="font-semibold">Customer:</span> {sale.customerName || "Walk-in"}
        </p>
        {sale.prescriptionRef ? (
          <p>
            <span className="font-semibold">Prescription ref:</span> {sale.prescriptionRef}
          </p>
        ) : null}
        {sale.doctorName ? (
          <p>
            <span className="font-semibold">Doctor:</span> {sale.doctorName}
          </p>
        ) : null}

        <hr className="my-2 border-dashed border-gray-400" />

        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="pb-1 font-semibold">Item</th>
              <th className="pb-1 text-right font-semibold">Qty</th>
              <th className="pb-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, i) => (
              <tr key={`${item.batchNo}-${i}`} className="align-top">
                <td className="py-1 pr-2">
                  <span className="font-medium">{item.medicineName}</span>
                  <br />
                  <span className="text-gray-600">
                    Batch {item.batchNo} · Exp {formatDate(item.expiryDate)}
                  </span>
                  <br />
                  <span className="text-gray-600">
                    {formatPKR(item.unitPrice, currency)}/unit
                    {item.discount > 0 ? ` · Discount ${formatPKR(item.discount, currency)}` : ""}
                  </span>
                </td>
                <td className="py-1 text-right">
                  {item.qtyDisplay} {item.displayUnit}
                </td>
                <td className="py-1 text-right">{formatPKR(item.total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr className="my-2 border-dashed border-gray-400" />

        <div className="space-y-0.5">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPKR(sale.subtotal, currency)}</span>
          </p>
          {sale.discount > 0 && (
            <p className="flex justify-between">
              <span>Discount</span>
              <span>− {formatPKR(sale.discount, currency)}</span>
            </p>
          )}
          {sale.tax > 0 && (
            <p className="flex justify-between">
              <span>Tax</span>
              <span>{formatPKR(sale.tax, currency)}</span>
            </p>
          )}
          <p className="flex justify-between text-sm font-bold">
            <span>Grand total</span>
            <span>{formatPKR(sale.grandTotal, currency)}</span>
          </p>
          <p className="flex justify-between">
            <span>Payment ({sale.paymentMethod})</span>
            <span>{formatPKR(sale.amountReceived, currency)}</span>
          </p>
          {sale.paymentMethod === "Credit" ? (
            <p className="flex justify-between">
              <span>Credit (Udhaar)</span>
              <span>{formatPKR(sale.grandTotal, currency)}</span>
            </p>
          ) : (
            <p className="flex justify-between">
              <span>Change due</span>
              <span>{formatPKR(sale.changeDue, currency)}</span>
            </p>
          )}
        </div>

        <hr className="my-2 border-dashed border-gray-400" />

        <p className="text-center">{settings?.receiptFooter || "Thank you! Get well soon."}</p>
      </div>

      <div className="no-print mx-auto mt-4 flex max-w-[80mm] flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Print
        </button>
        <Link
          href={sale.id ? `/sales/${sale.id}` : "/sales"}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
        >
          Back to sale
        </Link>
      </div>
    </div>
  );
}
