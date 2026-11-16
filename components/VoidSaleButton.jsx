// SAVE AS: pharmacy-pos/components/VoidSaleButton.jsx
// FROZEN CONTRACT (Phase 3 renders this for admin only):
//   props: { saleId, billNo, isVoided }. Do not change the props.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui.jsx";

export default function VoidSaleButton({ saleId, billNo, isVoided }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [voiding, setVoiding] = useState(false);

  if (isVoided) {
    return (
      <span className="inline-block cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-500">
        Voided
      </span>
    );
  }

  async function handleVoid() {
    setError("");

    const confirmed = window.confirm(
      `Void sale ${billNo}? This restores all remaining stock and cannot be undone.`
    );
    if (!confirmed) return;

    const reason = window.prompt(
      `Reason for voiding sale ${billNo} (required):`
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError("A reason is required to void a sale.");
      return;
    }

    setVoiding(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not void sale.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not void sale. Check the connection and try again.");
    } finally {
      setVoiding(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleVoid}
        disabled={voiding}
        className="btn btn-danger"
      >
        <Icon name="ban" className="h-4 w-4" />
        {voiding ? "Voiding…" : "Void sale"}
      </button>
      {error ? (
        <span role="alert" className="text-sm font-medium text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
