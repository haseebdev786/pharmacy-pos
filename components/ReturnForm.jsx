// SAVE AS: pharmacy-pos/components/ReturnForm.jsx
// FROZEN CONTRACT (Phase 3 renders this for pharmacist+ only):
//   props: { sale } where sale = { id, billNo, status, paymentMethod,
//     grandTotal, items: [{ id, medicineId, medicineName, batchId,
//     batchNo, expiryDate (ISO string), qtyBaseUnits, unitPrice,
//     discount, total, returnedQty }] }.
// Do not change the props: Phase 3 passes exactly this shape.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { round2, formatPKR, formatDate } from "@/lib/format";

export default function ReturnForm({ sale }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const items = sale?.items ?? [];

  function remainingFor(item) {
    return Math.max(0, item.qtyBaseUnits - (item.returnedQty ?? 0));
  }

  function qtyFor(item) {
    const raw = quantities[item.id];
    if (raw === undefined || raw === "") return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  // Average net price per base unit (item.total is already net of the
  // line discount), matching the server's refund formula:
  //   refund = round2((item.total / item.qtyBaseUnits) * qtyReturned)
  function refundFor(item) {
    const qty = qtyFor(item);
    if (!item.qtyBaseUnits || qty <= 0) return 0;
    return round2((item.total / item.qtyBaseUnits) * qty);
  }

  const estimatedRefund = round2(items.reduce((sum, item) => sum + refundFor(item), 0));
  const hasAnyQty = items.some((item) => qtyFor(item) > 0);
  const allReturned =
    items.length > 0 && items.every((item) => remainingFor(item) <= 0);

  function setQty(item, value) {
    setQuantities((prev) => ({ ...prev, [item.id]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!reason.trim()) {
      setError("A reason is required for a return.");
      return;
    }
    if (!hasAnyQty) {
      setError("Enter a quantity to return for at least one item.");
      return;
    }
    for (const item of items) {
      const qty = qtyFor(item);
      const raw = quantities[item.id];
      if (raw !== undefined && raw !== "" && (!Number.isInteger(qty) || qty < 0)) {
        setError(`Quantity for ${item.medicineName} must be a whole number.`);
        return;
      }
      if (qty > remainingFor(item)) {
        setError(
          `Only ${remainingFor(item)} unit(s) of ${item.medicineName} (batch ${item.batchNo}) can still be returned.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          reason: reason.trim(),
          items: items
            .filter((item) => qtyFor(item) > 0)
            .map((item) => ({
              saleItemId: item.id,
              qtyBaseUnits: qtyFor(item),
            })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Shown verbatim: the server names the exact problem, including
        // an expired batch rejecting the whole return.
        setError(data?.error || "Could not record return.");
        return;
      }
      setSuccess(
        `Return recorded. Refund total: ${formatPKR(data.refundTotal ?? estimatedRefund)}. Stock has been restored to the original batches.`
      );
      setQuantities({});
      setReason("");
      router.refresh();
    } catch {
      setError("Could not record return. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (sale?.status === "voided") {
    return (
      <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
        Sale {sale.billNo} is voided, so no return can be recorded against it.
      </p>
    );
  }

  if (allReturned) {
    return (
      <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
        Fully returned — every item on sale {sale.billNo} has already been
        returned in full.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
    >
      <h2 className="font-semibold text-gray-900">Return items — {sale.billNo}</h2>

      <div className="space-y-3">
        {items.map((item) => {
          const remaining = remainingFor(item);
          return (
            <div
              key={item.id}
              className="grid gap-2 border-b border-gray-50 pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="text-sm">
                <p className="font-medium text-gray-900">{item.medicineName}</p>
                <p className="text-gray-600">
                  Batch {item.batchNo} · Expiry {formatDate(item.expiryDate)}
                </p>
                <p className="text-gray-600">
                  Sold {item.qtyBaseUnits} · Already returned {item.returnedQty ?? 0} ·
                  Remaining {remaining}
                </p>
                {qtyFor(item) > 0 ? (
                  <p className="text-gray-600">
                    Refund for this line:{" "}
                    <span className="font-medium text-gray-900">
                      {formatPKR(refundFor(item))}
                    </span>
                  </p>
                ) : null}
              </div>
              <label className="block text-sm">
                <span className="font-medium text-gray-900">Qty to return</span>
                <input
                  type="number"
                  min="0"
                  max={remaining}
                  step="1"
                  className="mt-1 w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                  value={quantities[item.id] ?? "0"}
                  onChange={(e) => setQty(item, e.target.value)}
                  disabled={remaining <= 0}
                />
              </label>
            </div>
          );
        })}
      </div>

      <label className="block text-sm">
        <span className="font-medium text-gray-900">Reason *</span>
        <textarea
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is the customer returning these items?"
          required
        />
      </label>

      <p className="text-sm text-gray-600">
        Estimated refund:{" "}
        <span className="font-medium text-gray-900">{formatPKR(estimatedRefund)}</span>
      </p>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-sm font-medium text-green-700">
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving || !hasAnyQty}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {saving ? "Recording…" : "Record return"}
      </button>
    </form>
  );
}
