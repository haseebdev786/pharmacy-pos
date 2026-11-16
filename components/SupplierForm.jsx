// SAVE AS: pharmacy-pos/components/SupplierForm.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  address: "",
  company: "",
  notes: "",
};

export default function SupplierForm({ supplier }) {
  const router = useRouter();
  const isEdit = Boolean(supplier?.id);
  const [values, setValues] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    company: supplier?.company ?? "",
    notes: supplier?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!values.name.trim()) {
      setError("Supplier name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        isEdit ? `/api/suppliers/${supplier.id}` : "/api/suppliers",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not save supplier.");
        return;
      }
      setSuccess(
        isEdit ? "Supplier updated." : "Supplier added."
      );
      if (!isEdit) setValues(EMPTY);
      router.refresh();
    } catch {
      setError("Could not save supplier. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900";

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Name *</span>
          <input
            className={inputClass}
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Ahmed Distributors"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Company / distributor</span>
          <input
            className={inputClass}
            value={values.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="e.g. City Pharma Distribution"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Phone</span>
          <input
            className={inputClass}
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="03xx-xxxxxxx"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-900">Email</span>
          <input
            type="email"
            className={inputClass}
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="supplier@example.com"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-gray-900">Address</span>
          <input
            className={inputClass}
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Shop / warehouse address"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-gray-900">Notes</span>
          <textarea
            className={inputClass}
            rows={2}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Payment terms, delivery days, contact person…"
          />
        </label>
      </div>

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
        {saving ? "Saving…" : isEdit ? "Save changes" : "Add supplier"}
      </button>
    </form>
  );
}
