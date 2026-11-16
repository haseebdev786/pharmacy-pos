// SAVE AS: pharmacy-pos/components/ExpenseForm.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = ["Rent", "Salaries", "Utilities", "Transport", "Other"];

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ExpenseForm() {
  const router = useRouter();
  const [date, setDate] = useState(todayInputValue());
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: date || undefined,
          category,
          amount: Number(amount),
          note: note.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not save the expense.");
        return;
      }
      setDate(todayInputValue());
      setCategory("");
      setAmount("");
      setNote("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm">
          <span className="label">Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
            className="input"
          />
        </label>
        <label className="block text-sm">
          <span className="label">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
            className="input"
          >
            <option value="">Select category</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="label">Amount (Rs)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            placeholder="0.00"
            className="input"
          />
        </label>
        <label className="block text-sm">
          <span className="label">Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. March shop rent"
            className="input"
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary"
      >
        {saving ? "Saving..." : "Add expense"}
      </button>
    </form>
  );
}
