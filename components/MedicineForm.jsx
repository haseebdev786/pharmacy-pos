// SAVE AS: pharmacy-pos/components/MedicineForm.jsx
// Create/edit form for a medicine. Props are plain objects only:
// `medicine` holds strings/numbers/booleans (no Dates), or null for
// create mode. Submits to POST /api/medicines or PUT
// /api/medicines/[id], shows the server error message verbatim, and on
// success goes to the medicine detail page.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Cream",
  "Drops",
  "Inhaler",
  "Other",
];
const UNITS = ["strip", "box", "bottle", "piece"];

const inputClass = "input";
const labelClass = "label";

export default function MedicineForm({ medicine, onCancelHref }) {
  const router = useRouter();
  const isEdit = Boolean(medicine?.id);

  const [name, setName] = useState(medicine?.name ?? "");
  const [genericName, setGenericName] = useState(medicine?.genericName ?? "");
  const [manufacturer, setManufacturer] = useState(medicine?.manufacturer ?? "");
  const [strength, setStrength] = useState(medicine?.strength ?? "");
  const [form, setForm] = useState(medicine?.form ?? "Tablet");
  const [category, setCategory] = useState(medicine?.category ?? "");
  const [unit, setUnit] = useState(medicine?.unit ?? "strip");
  const [unitsPerStrip, setUnitsPerStrip] = useState(String(medicine?.unitsPerStrip ?? 1));
  const [barcode, setBarcode] = useState(medicine?.barcode ?? "");
  const [sku, setSku] = useState(medicine?.sku ?? "");
  const [reorderLevel, setReorderLevel] = useState(String(medicine?.reorderLevel ?? 0));
  const [requiresPrescription, setRequiresPrescription] = useState(
    medicine?.requiresPrescription ?? false
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        genericName: genericName.trim(),
        manufacturer: manufacturer.trim(),
        strength: strength.trim(),
        form,
        category: category.trim(),
        unit,
        unitsPerStrip: Number(unitsPerStrip),
        barcode: barcode.trim(),
        sku: sku.trim(),
        reorderLevel: Number(reorderLevel),
        requiresPrescription,
      };
      const res = await fetch(
        isEdit ? `/api/medicines/${medicine.id}` : "/api/medicines",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Something went wrong.");
        return;
      }
      router.push(`/medicines/${data.id}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card card-pad"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="medicine-name">
            Name *
          </label>
          <input
            id="medicine-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Panadol Extra"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-generic">
            Generic name
          </label>
          <input
            id="medicine-generic"
            type="text"
            value={genericName}
            onChange={(e) => setGenericName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Paracetamol"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-manufacturer">
            Manufacturer
          </label>
          <input
            id="medicine-manufacturer"
            type="text"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            className={inputClass}
            placeholder="e.g. GSK"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-strength">
            Strength
          </label>
          <input
            id="medicine-strength"
            type="text"
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
            className={inputClass}
            placeholder="e.g. 500mg"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-form">
            Form *
          </label>
          <select
            id="medicine-form"
            required
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className={inputClass}
          >
            {FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-category">
            Category
          </label>
          <input
            id="medicine-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
            placeholder="e.g. Pain relief"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-unit">
            Sold by
          </label>
          <select
            id="medicine-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={inputClass}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-units-per-strip">
            Units per {unit} *
          </label>
          <input
            id="medicine-units-per-strip"
            type="number"
            required
            min="1"
            step="1"
            value={unitsPerStrip}
            onChange={(e) => setUnitsPerStrip(e.target.value)}
            className={inputClass}
          />
          <p className="form-note">
            Base units in one {unit} (1 = sold per piece). Stock is counted
            in base units.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-barcode">
            Barcode
          </label>
          <input
            id="medicine-barcode"
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-sku">
            SKU
          </label>
          <input
            id="medicine-sku"
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="medicine-reorder">
            Reorder level (base units) *
          </label>
          <input
            id="medicine-reorder"
            type="number"
            required
            min="0"
            step="1"
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
            className={inputClass}
          />
          <p className="form-note">
            At or below this stock the medicine shows as low stock.
          </p>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={requiresPrescription}
              onChange={(e) => setRequiresPrescription(e.target.checked)}
              className="h-4 w-4"
            />
            Requires prescription
          </label>
        </div>
      </div>

      {error ? (
        <p role="alert" className="form-error mt-4">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add medicine"}
        </button>
        <Link
          href={onCancelHref}
          className="btn btn-secondary"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
