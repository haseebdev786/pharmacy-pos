// SAVE AS: pharmacy-pos/components/ExpenseDeleteButton.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin only — the expenses page renders this button only for admins.
// Deleting is how a wrong expense is corrected: delete it, then re-add
// it with the right details (there is no expense edit API on purpose).
export default function ExpenseDeleteButton({ expenseId }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this expense? This cannot be undone. Re-add it if the details were wrong."
    );
    if (!confirmed) return;
    setError("");
    setDeleting(true);
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not delete the expense.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg border border-red-200 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
