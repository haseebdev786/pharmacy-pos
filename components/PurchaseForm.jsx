// SAVE AS: pharmacy-pos/components/PurchaseForm.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { round2, formatPKR } from "@/lib/format";

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse a yyyy-mm-dd input value as LOCAL midnight (new Date("2026-01-01")
// alone parses as UTC and shifts the day in PKT).
function parseDayLocal(value) {
  const parts = String(value || "").split("-");
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function emptyLine() {
  return {
    medicineId: "",
    search: "",
    batchNo: "",
    expiryDate: "",
    mfgDate: "",
    qtyBaseUnits: "",
    purchasePrice: "",
    salePrice: "",
  };
}

function medicineLabel(m) {
  const bits = [m.name];
  if (m.strength) bits.push(m.strength);
  if (m.form) bits.push(m.form);
  if (m.genericName) bits.push(`(${m.genericName})`);
  return bits.join(" ");
}

export default function PurchaseForm({ suppliers, medicines }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [discount, setDiscount] = useState("");
  const [paid, setPaid] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateLine(index, field, value) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function lineTotal(line) {
    const qty = Number(line.qtyBaseUnits);
    const price = Number(line.purchasePrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
    return round2(price * qty);
  }

  const subtotal = round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));
  const discountAmount = round2(Number(discount) || 0);
  const total = round2(subtotal - discountAmount);
  const paidAmount = round2(Number(paid) || 0);
  const due = round2(total - paidAmount);

  function validate() {
    if (!supplierId) return "Select a supplier.";
    if (lines.length === 0) return "Add at least one purchase line.";
    const today = startOfToday();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const label = `Line ${i + 1}`;
      if (!line.medicineId) return `${label}: select a medicine.`;
      if (!line.batchNo.trim()) return `${label}: batch number is required.`;
      if (!line.expiryDate) return `${label}: expiry date is required.`;
      const expiry = parseDayLocal(line.expiryDate);
      if (!expiry) return `${label}: expiry date is not valid.`;
      if (expiry < today) return `${label}: expiry date is in the past.`;
      if (line.mfgDate && !parseDayLocal(line.mfgDate)) {
        return `${label}: manufacturing date is not valid.`;
      }
      const qty = Number(line.qtyBaseUnits);
      if (!Number.isInteger(qty) || qty <= 0) {
        return `${label}: quantity must be a whole number greater than 0.`;
      }
      const purchasePrice = Number(line.purchasePrice);
      if (line.purchasePrice === "" || !Number.isFinite(purchasePrice) || purchasePrice < 0) {
        return `${label}: purchase price must be 0 or more.`;
      }
      const salePrice = Number(line.salePrice);
      if (line.salePrice === "" || !Number.isFinite(salePrice) || salePrice < 0) {
        return `${label}: sale price must be 0 or more.`;
      }
    }
    if (discount !== "" && (!Number.isFinite(Number(discount)) || Number(discount) < 0)) {
      return "Discount must be 0 or more.";
    }
    if (discountAmount > subtotal) {
      return "Discount cannot be more than the subtotal.";
    }
    if (paid !== "" && (!Number.isFinite(Number(paid)) || Number(paid) < 0)) {
      return "Paid must be 0 or more.";
    }
    if (paidAmount > total) {
      return "Paid cannot be more than the total.";
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          invoiceNo: invoiceNo.trim() || undefined,
          date: date ? new Date(`${date}T00:00:00`).toISOString() : undefined,
          discount: discountAmount,
          paid: paidAmount,
          items: lines.map((line) => ({
            medicineId: line.medicineId,
            batchNo: line.batchNo.trim(),
            expiryDate: new Date(`${line.expiryDate}T00:00:00`).toISOString(),
            mfgDate: line.mfgDate
              ? new Date(`${line.mfgDate}T00:00:00`).toISOString()
              : undefined,
            qtyBaseUnits: Number(line.qtyBaseUnits),
            purchasePrice: Number(line.purchasePrice),
            salePrice: Number(line.salePrice),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Show the server's message verbatim — it names the exact line
        // and problem (e.g. a past expiry or an inactive medicine).
        setError(data?.error || "Could not save purchase.");
        return;
      }
      router.push(`/purchases/${data.id}`);
    } catch {
      setError("Could not save purchase. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900";
  const labelClass = "block text-xs font-medium text-gray-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Supplier *</span>
          <select
            className={inputClass}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          >
            <option value="">Select supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {suppliers.length === 0 ? (
            <span className="mt-1 block text-xs text-red-600">
              No suppliers yet — add one on the Suppliers page first.
            </span>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Invoice no.</span>
          <input
            className={inputClass}
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="Supplier invoice number"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Date</span>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="text-sm">
          <span className="font-medium text-gray-900">Lines</span>
          <p className="mt-2 text-gray-600">{lines.length} line(s)</p>
        </div>
      </div>

      {medicines.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
          No active medicines yet. Add medicines first, then record purchases.
        </p>
      ) : null}

      {lines.map((line, index) => {
        const medicine = medicines.find((m) => m.id === line.medicineId);
        const query = line.search.trim().toLowerCase();
        let options = medicines;
        if (query) {
          options = medicines.filter((m) =>
            [m.name, m.genericName, m.strength, m.form]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(query)
          );
        }
        // Keep the selected medicine visible even when the search
        // filter would hide it, so the select never blanks out.
        if (medicine && !options.some((m) => m.id === medicine.id)) {
          options = [medicine, ...options];
        }
        const qty = Number(line.qtyBaseUnits);
        const showStripHelper =
          medicine &&
          Number.isFinite(qty) &&
          qty > 0 &&
          medicine.unitsPerStrip > 0;

        return (
          <div
            key={index}
            className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Line {index + 1}</h2>
              {lines.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="text-sm font-medium text-red-600 hover:text-red-800"
                >
                  Remove line
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={labelClass}>Search medicine</span>
                <input
                  className={inputClass}
                  value={line.search}
                  onChange={(e) => updateLine(index, "search", e.target.value)}
                  placeholder="Type to filter the list…"
                />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Medicine *</span>
                <select
                  className={inputClass}
                  value={line.medicineId}
                  onChange={(e) => updateLine(index, "medicineId", e.target.value)}
                  required
                >
                  <option value="">Select medicine…</option>
                  {options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {medicineLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm">
                <span className={labelClass}>Batch no. *</span>
                <input
                  className={inputClass}
                  value={line.batchNo}
                  onChange={(e) => updateLine(index, "batchNo", e.target.value)}
                  placeholder="e.g. B-1024"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Expiry date *</span>
                <input
                  type="date"
                  className={inputClass}
                  value={line.expiryDate}
                  onChange={(e) => updateLine(index, "expiryDate", e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Manufacturing date</span>
                <input
                  type="date"
                  className={inputClass}
                  value={line.mfgDate}
                  onChange={(e) => updateLine(index, "mfgDate", e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Quantity (base units) *</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={inputClass}
                  value={line.qtyBaseUnits}
                  onChange={(e) => updateLine(index, "qtyBaseUnits", e.target.value)}
                  placeholder="e.g. 100"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Purchase price (per unit) *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={line.purchasePrice}
                  onChange={(e) => updateLine(index, "purchasePrice", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Sale price (per unit) *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={line.salePrice}
                  onChange={(e) => updateLine(index, "salePrice", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <p className="text-gray-600">
                Line total:{" "}
                <span className="font-medium text-gray-900">
                  {formatPKR(lineTotal(line))}
                </span>
              </p>
              {showStripHelper ? (
                <p className="text-gray-500">
                  {qty} base units = {(qty / medicine.unitsPerStrip).toFixed(2)}{" "}
                  {medicine.unit}(s) ({medicine.unitsPerStrip} units per {medicine.unit})
                </p>
              ) : null}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addLine}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
      >
        + Add line
      </button>

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Discount (Rs)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-900">Paid (Rs)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="0.00"
            />
          </label>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Subtotal</dt>
            <dd className="font-medium text-gray-900">{formatPKR(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Discount</dt>
            <dd className="font-medium text-gray-900">− {formatPKR(discountAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1">
            <dt className="font-medium text-gray-900">Total</dt>
            <dd className="font-bold text-gray-900">{formatPKR(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Paid</dt>
            <dd className="font-medium text-gray-900">{formatPKR(paidAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-gray-900">Due</dt>
            <dd
              className={`font-bold ${due > 0 ? "text-red-600" : "text-gray-900"}`}
            >
              {formatPKR(due)}
            </dd>
          </div>
        </dl>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving || medicines.length === 0}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save purchase"}
      </button>
    </form>
  );
}
