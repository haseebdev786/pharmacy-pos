// SAVE AS: pharmacy-pos/components/SettingsForm.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Props: { settings } — a plain object with the editable Setting fields
// (storeName, address, phone, currency, taxRate, taxEnabled,
// receiptFooter, expiryWarningDays, creditWarnAt). No updatedAt, no
// Date objects. Number fields are kept as strings in state and parsed
// only when saving, so typing stays natural.
export default function SettingsForm({ settings }) {
  const router = useRouter();
  const [storeName, setStoreName] = useState(settings.storeName ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [currency, setCurrency] = useState(settings.currency ?? "Rs");
  const [taxRate, setTaxRate] = useState(String(settings.taxRate ?? 0));
  const [taxEnabled, setTaxEnabled] = useState(Boolean(settings.taxEnabled));
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter ?? "");
  const [expiryWarningDays, setExpiryWarningDays] = useState(
    String(settings.expiryWarningDays ?? 90)
  );
  const [creditWarnAt, setCreditWarnAt] = useState(
    String(settings.creditWarnAt ?? 0)
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: storeName.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          currency: currency.trim(),
          taxRate: Number(taxRate),
          taxEnabled,
          receiptFooter: receiptFooter.trim() || undefined,
          expiryWarningDays: Number(expiryWarningDays),
          creditWarnAt: Number(creditWarnAt),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not save settings.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "input";
  const labelClass = "label";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={labelClass}>Store name</span>
          <input
            type="text"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
            required
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className={labelClass}>Phone</span>
          <input
            type="text"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 0300-1234567"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className={labelClass}>Address</span>
          <input
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Shop address, printed on receipts"
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className={labelClass}>Currency</span>
          <input
            type="text"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            required
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className={labelClass}>Tax rate (%)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
            required
            className={fieldClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(event) => setTaxEnabled(event.target.checked)}
            className="h-4 w-4"
          />
          <span className="font-medium text-slate-700">
            Charge tax on bills (uses the rate above)
          </span>
        </label>
        <label className="block text-sm">
          <span className={labelClass}>Expiry warning (days)</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={expiryWarningDays}
            onChange={(event) => setExpiryWarningDays(event.target.value)}
            required
            className={fieldClass}
          />
          <span className="form-note block">
            Batches expiring within this many days show in the expiry report.
          </span>
        </label>
        <label className="block text-sm">
          <span className={labelClass}>Receipt footer</span>
          <input
            type="text"
            value={receiptFooter}
            onChange={(event) => setReceiptFooter(event.target.value)}
            placeholder="Thank you! Get well soon."
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className={labelClass}>Credit warning limit (Rs)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={creditWarnAt}
            onChange={(event) => setCreditWarnAt(event.target.value)}
            required
            className={fieldClass}
          />
          <span className="form-note block">
            Warn when a customer&apos;s credit passes this amount. 0 turns the
            warning off.
          </span>
        </label>
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-emerald-700">
          Settings saved. Billing and receipts now use these values.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
