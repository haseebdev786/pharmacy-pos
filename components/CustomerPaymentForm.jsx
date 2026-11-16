// SAVE AS: pharmacy-pos/components/CustomerPaymentForm.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPKR } from "@/lib/format";

const METHODS = ["Cash", "Card", "Bank", "JazzCash", "EasyPaisa"];

export default function CustomerPaymentForm({ customerId, creditBalance }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const amountNumber = Number(amount);
  const overpays =
    amount !== "" &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    amountNumber > creditBalance;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNumber,
          method,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not record payment.");
        return;
      }
      setSuccess(
        `Payment of ${formatPKR(data.amount ?? amountNumber)} recorded. New balance: ${formatPKR(
          data.creditBalance ?? 0
        )}.`
      );
      setAmount("");
      setNote("");
      router.refresh();
    } catch {
      setError("Could not record payment. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900";

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <p className="text-sm text-gray-600">
        Current balance:{" "}
        <span className="font-medium text-gray-900">{formatPKR(creditBalance)}</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Amount (Rs) *</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Method *</span>
          <select
            className={inputClass}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-gray-900">Note</span>
          <input
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note, e.g. bill number"
          />
        </label>
      </div>

      {overpays ? (
        <p role="alert" className="text-sm font-medium text-amber-700">
          This amount is more than the outstanding balance of{" "}
          {formatPKR(creditBalance)}. You can still record it — the balance
          will simply stop at Rs 0.00 and will never go negative.
        </p>
      ) : null}
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
        disabled={saving}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {saving ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
