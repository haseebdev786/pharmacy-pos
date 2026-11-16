// SAVE AS: pharmacy-pos/components/AdjustmentForm.jsx
// Compact inline stock adjustment for one batch: new quantity +
// required reason, posted to /api/inventory/adjustments. The API
// rejects a no-change quantity and enforces the pharmacist+ role;
// this form is only rendered for those roles.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdjustmentForm({ batchId, batchNo, currentQuantity, medicineName }) {
  const router = useRouter();
  const [newQuantity, setNewQuantity] = useState(String(currentQuantity));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const parsed = Number(newQuantity);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Enter a whole number of 0 or more.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, newQuantity: parsed, reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not save the adjustment.");
        return;
      }
      setReason("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <span className="sr-only">
        Adjust stock for {medicineName}, batch {batchNo}
      </span>
      <label className="sr-only" htmlFor={`qty-${batchId}`}>
        New quantity
      </label>
      <input
        id={`qty-${batchId}`}
        type="number"
        min="0"
        step="1"
        value={newQuantity}
        onChange={(e) => setNewQuantity(e.target.value)}
        className="input input-sm w-20"
      />
      <label className="sr-only" htmlFor={`reason-${batchId}`}>
        Reason
      </label>
      <input
        id={`reason-${batchId}`}
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        className="input input-sm w-44"
      />
      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary btn-sm"
      >
        Save
      </button>
      {error ? (
        <span role="alert" className="field-error text-xs">
          {error}
        </span>
      ) : null}
    </form>
  );
}
