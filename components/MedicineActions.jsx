// SAVE AS: pharmacy-pos/components/MedicineActions.jsx
// Deactivate / reactivate buttons for a medicine. Deactivation is a
// soft delete (DELETE sets isActive=false); nothing is hard-deleted.
// Reactivation is PUT { isActive: true }. The API enforces the
// pharmacist+ role; this component only renders for those roles.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MedicineActions({ medicineId, isActive }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDeactivate() {
    if (
      !window.confirm(
        "Deactivate this medicine? It will no longer appear for new bills, but its sales and stock history are kept. You can reactivate it later."
      )
    ) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/medicines/${medicineId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not deactivate the medicine.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReactivate() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/medicines/${medicineId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not reactivate the medicine.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {isActive ? (
        <button
          type="button"
          onClick={handleDeactivate}
          disabled={busy}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-300 disabled:opacity-50"
        >
          Deactivate
        </button>
      ) : (
        <button
          type="button"
          onClick={handleReactivate}
          disabled={busy}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Reactivate
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
