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
          className="btn btn-danger-outline"
        >
          Deactivate
        </button>
      ) : (
        <button
          type="button"
          onClick={handleReactivate}
          disabled={busy}
          className="btn btn-primary"
        >
          Reactivate
        </button>
      )}
      {error ? (
        <p role="alert" className="field-error mt-2 max-w-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
