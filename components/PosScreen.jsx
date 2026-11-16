// SAVE AS: pharmacy-pos/components/PosScreen.jsx
// The counter billing screen. Keyboard-first: search, Enter to add,
// FEFO batch picked automatically, manual batch override for
// pharmacist+ only. All money math uses round2()/formatPKR from
// lib/format.js (client-safe). Prices shown come from the batch;
// the server re-derives every price and re-validates stock on save.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { round2, formatPKR, daysToExpiry } from "@/lib/format";
import { PageHeader, Icon, Badge } from "@/components/ui.jsx";

const PAYMENT_METHODS = ["Cash", "Card", "Bank", "JazzCash", "EasyPaisa", "Credit"];

function sellableBatches(medicine) {
  const batches = Array.isArray(medicine?.batches) ? medicine.batches : [];
  return batches
    .filter((b) => b.quantity > 0 && daysToExpiry(b.expiryDate) >= 0)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
}

function pickFefo(medicine) {
  return sellableBatches(medicine)[0] || null;
}

// qtyDisplay + displayUnit -> base units. Must be a positive integer:
// 0.33 strips of 10 tablets = 3.3 units is NOT sellable.
function qtyFor(line) {
  const q = Number(line.qtyDisplay);
  if (!Number.isFinite(q) || q <= 0) {
    return { qty: null, error: "Enter a quantity greater than 0." };
  }
  const base = line.displayUnit === "piece" ? q : q * Number(line.unitsPerStrip || 1);
  if (!Number.isInteger(base)) {
    return {
      qty: null,
      error: `That is ${base} base unit(s) — quantity must be a whole number of units.`,
    };
  }
  return { qty: base, error: null };
}

function unitOptions(line) {
  return [...new Set([line.unit, "piece"])];
}

export default function PosScreen({ user, settings }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAdd, setQuickAdd] = useState({ name: "", phone: "", address: "" });
  const [quickAddError, setQuickAddError] = useState("");
  const [discountInput, setDiscountInput] = useState("0");
  const [discountType, setDiscountType] = useState("amount");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [prescriptionRef, setPrescriptionRef] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState(null);

  const searchRef = useRef(null);
  const keyRef = useRef(0);

  const canOverrideBatch = user.role === "admin" || user.role === "pharmacist";

  // --- Debounced medicine search (~250ms). ---
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/medicines?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // --- Debounced customer search. ---
  useEffect(() => {
    const q = customerQuery.trim();
    if (!q) {
      setCustomerResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled) setCustomerResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCustomerResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [customerQuery]);

  function focusSearch() {
    searchRef.current?.focus();
  }

  // Units of the same batch already used by OTHER cart lines.
  function usedByOtherLines(line) {
    return cart.reduce((sum, other) => {
      if (other.key === line.key || other.batchId !== line.batchId) return sum;
      const { qty } = qtyFor(other);
      return sum + (qty || 0);
    }, 0);
  }

  function lineError(line) {
    const { qty, error: qtyError } = qtyFor(line);
    if (qtyError) return qtyError;
    const available = line.batchQuantity - usedByOtherLines(line);
    if (qty > available) {
      return `Only ${available} unit(s) left in batch ${line.batchNo}.`;
    }
    const disc = Number(line.discount);
    if (!Number.isFinite(disc) || disc < 0) return "Line discount must be 0 or more.";
    const gross = round2(line.unitPrice * qty);
    if (disc >= gross) return "Line discount must be less than the line total.";
    return null;
  }

  function addMedicine(medicine) {
    const batch = pickFefo(medicine);
    if (!batch) {
      setError(`${medicine.name}: out of stock / expired only — cannot be added.`);
      return;
    }
    setError("");
    const existing = cart.find(
      (l) => l.medicineId === medicine.id && l.batchId === batch.id
    );
    if (existing) {
      // Same medicine + batch: increase qty by 1 display unit, if stock allows.
      const current = qtyFor(existing);
      const step =
        existing.displayUnit === "piece" ? 1 : Number(existing.unitsPerStrip || 1);
      const nextQty = (current.qty || 0) + step;
      const available = existing.batchQuantity - usedByOtherLines(existing);
      if (nextQty > available) {
        setError(`Not enough stock in batch ${existing.batchNo} to add another.`);
        return;
      }
      const nextDisplay = Number(existing.qtyDisplay) + 1;
      setCart((prev) =>
        prev.map((l) => (l.key === existing.key ? { ...l, qtyDisplay: String(nextDisplay) } : l))
      );
    } else {
      keyRef.current += 1;
      setCart((prev) => [
        ...prev,
        {
          key: `${medicine.id}:${batch.id}:${keyRef.current}`,
          medicineId: medicine.id,
          medicineName: medicine.name,
          unit: medicine.unit || "strip",
          unitsPerStrip: medicine.unitsPerStrip || 1,
          batchId: batch.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          batchQuantity: batch.quantity,
          batches: sellableBatches(medicine),
          qtyDisplay: "1",
          displayUnit: medicine.unit || "strip",
          unitPrice: batch.salePrice,
          purchasePrice: batch.purchasePrice,
          discount: "0",
        },
      ]);
    }
    setQuery("");
    setResults([]);
    focusSearch();
  }

  function handleSearchKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q || results.length === 0) return;
    // Exact barcode/SKU match first, else first result with sellable stock.
    const exact = results.find(
      (m) =>
        (m.barcode && String(m.barcode).toLowerCase() === q) ||
        (m.sku && String(m.sku).toLowerCase() === q)
    );
    const best = exact || results.find((m) => pickFefo(m));
    if (best) addMedicine(best);
  }

  function updateLine(key, patch) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function changeBatch(line, batchId) {
    const batch = line.batches.find((b) => b.id === batchId);
    if (!batch) return;
    updateLine(line.key, {
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      batchQuantity: batch.quantity,
      unitPrice: batch.salePrice,
      purchasePrice: batch.purchasePrice,
    });
  }

  function removeLine(key) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  async function quickAddCustomer(e) {
    e.preventDefault();
    setQuickAddError("");
    const name = quickAdd.name.trim();
    if (!name) {
      setQuickAddError("Customer name is required.");
      return;
    }
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: quickAdd.phone.trim() || undefined,
          address: quickAdd.address.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickAddError(data.error || "Could not add customer.");
        return;
      }
      setCustomer(data);
      setCustomerQuery("");
      setCustomerResults([]);
      setShowQuickAdd(false);
      setQuickAdd({ name: "", phone: "", address: "" });
    } catch {
      setQuickAddError("Could not add customer. Check the connection and retry.");
    }
  }

  // --- Totals (only fully valid lines count; invalid lines block submit). ---
  const calcs = useMemo(
    () =>
      cart.map((line) => {
        const err = lineError(line);
        const { qty } = qtyFor(line);
        const gross = qty !== null ? round2(line.unitPrice * qty) : 0;
        const disc = round2(Number(line.discount) || 0);
        return { line, err, qty, gross, disc, total: err ? 0 : round2(gross - disc) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart]
  );

  const subtotal = round2(calcs.reduce((sum, c) => sum + c.total, 0));

  const discountRaw = Number(discountInput);
  let discountError = "";
  if (!Number.isFinite(discountRaw) || discountRaw < 0) {
    discountError = "Bill discount must be 0 or more.";
  } else if (discountType === "percent" && discountRaw > 100) {
    discountError = "Discount percent cannot be more than 100.";
  }
  const resolvedDiscount = discountError
    ? 0
    : discountType === "percent"
      ? round2((subtotal * discountRaw) / 100)
      : round2(discountRaw);
  if (!discountError && resolvedDiscount > subtotal) {
    discountError = "Bill discount cannot be more than the subtotal.";
  }

  const tax = settings.taxEnabled
    ? round2(((subtotal - resolvedDiscount) * Number(settings.taxRate || 0)) / 100)
    : 0;
  const grandTotal = round2(subtotal - resolvedDiscount + tax);

  const received = Number(amountReceived);
  const receivedValid = Number.isFinite(received) && received >= 0;
  const changeDue =
    paymentMethod === "Credit" ? 0 : receivedValid ? round2(received - grandTotal) : 0;
  const creditBlocked = paymentMethod === "Credit" && !customer;
  const canSubmit =
    cart.length > 0 &&
    calcs.every((c) => !c.err) &&
    !discountError &&
    !creditBlocked &&
    !submitting &&
    (paymentMethod === "Credit" || (receivedValid && received >= grandTotal));

  const creditWarning =
    customer &&
    Number(settings.creditWarnAt) > 0 &&
    round2(Number(customer.creditBalance || 0) + grandTotal) > Number(settings.creditWarnAt);

  function handlePaymentChange(method) {
    setPaymentMethod(method);
    if (method === "Credit") setAmountReceived("0");
    else setAmountReceived("");
  }

  async function submitBill() {
    setError("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        customerId: customer ? customer.id : null,
        prescriptionRef: prescriptionRef.trim() || undefined,
        doctorName: doctorName.trim() || undefined,
        discount: resolvedDiscount,
        paymentMethod,
        amountReceived: paymentMethod === "Credit" ? 0 : round2(received),
        items: calcs.map((c) => ({
          medicineId: c.line.medicineId,
          batchId: c.line.batchId,
          qtyBaseUnits: c.qty,
          qtyDisplay: Number(c.line.qtyDisplay),
          displayUnit: c.line.displayUnit,
          discount: c.disc,
        })),
      };
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save the bill.");
        return;
      }
      setLastSale({ billNo: data.billNo, id: data.id, changeDue: data.changeDue });
      setCart([]);
      setDiscountInput("0");
      setAmountReceived("");
      setPrescriptionRef("");
      setDoctorName("");
      setQuery("");
      setResults([]);
    } catch {
      setError("Could not save the bill. Check the connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  function newBill() {
    setLastSale(null);
    setCart([]);
    setCustomer(null);
    setCustomerQuery("");
    setDiscountInput("0");
    setDiscountType("amount");
    setPaymentMethod("Cash");
    setAmountReceived("");
    setPrescriptionRef("");
    setDoctorName("");
    setError("");
    setQuery("");
    setResults([]);
    focusSearch();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Billing"
        actions={
          <button
            type="button"
            onClick={() => setCart([])}
            className="btn btn-secondary btn-sm"
          >
            <Icon name="x" className="h-4 w-4" />
            Clear cart
          </button>
        }
      />

      {error && <div className="form-error">{error}</div>}

      {lastSale && (
        <div className="card card-pad">
          <div className="flex items-start gap-3">
            <span className="icon-chip">
              <Icon name="check" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-900">
                Bill {lastSale.billNo} saved.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Change due: {formatPKR(lastSale.changeDue, settings.currency)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/sales/${lastSale.id}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <Icon name="printer" className="h-4 w-4" />
                  Print receipt
                </a>
                <button
                  type="button"
                  onClick={newBill}
                  className="btn btn-secondary btn-sm"
                >
                  New bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* ---- Left: search + results + customer ---- */}
        <div className="space-y-4">
          <div className="card card-pad">
            <label htmlFor="pos-search" className="label">
              Search medicine (name, generic, barcode)
            </label>
            <input
              id="pos-search"
              ref={searchRef}
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Type name or scan barcode, then Enter"
              className="input mt-1"
            />
            {searching && <p className="mt-2 text-xs text-slate-500">Searching…</p>}
            {query.trim() && !searching && results.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">No medicines found.</p>
            )}
            <ul className="mt-2 divide-y divide-slate-100">
              {results.map((m) => {
                const fefo = pickFefo(m);
                const days = fefo ? daysToExpiry(fefo.expiryDate) : null;
                const nearExpiry =
                  fefo && days !== null && days <= Number(settings.expiryWarningDays);
                const perPack =
                  fefo && Number(m.unitsPerStrip) > 1
                    ? round2(fefo.salePrice * Number(m.unitsPerStrip))
                    : null;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => addMedicine(m)}
                      disabled={!fefo}
                      className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>
                        <span className="block font-medium text-slate-900">
                          {m.name}
                          {m.requiresPrescription ? (
                            <Badge tone="amber" className="ml-2">
                              Rx
                            </Badge>
                          ) : null}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {[m.genericName, m.strength, m.manufacturer].filter(Boolean).join(" · ")}
                          {m.totalStock !== undefined ? ` · Stock: ${m.totalStock}` : ""}
                        </span>
                        {fefo ? (
                          <span className="block text-xs text-slate-500">
                            Batch {fefo.batchNo} · {formatPKR(fefo.salePrice, settings.currency)}/unit
                            {perPack !== null
                              ? ` (${formatPKR(perPack, settings.currency)}/${m.unit})`
                              : ""}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-right">
                        {fefo ? (
                          <>
                            <span className="btn btn-primary btn-sm">
                              Add
                            </span>
                            {nearExpiry && (
                              <span className="mt-1 block text-xs font-medium text-amber-700">
                                Expires in {days} day(s)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="block text-xs font-medium text-red-600">
                            Out of stock / expired only
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="card card-pad">
            <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
            {customer ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{customer.name}</p>
                  <p className="text-xs text-slate-500">
                    {[customer.phone, customer.address].filter(Boolean).join(" · ")}
                    {` · Credit: ${formatPKR(customer.creditBalance || 0, settings.currency)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomer(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Walk-in
                </button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500">Walk-in customer (default).</p>
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search customer by name or phone"
                  className="input mt-2"
                />
                {customerResults.length > 0 && (
                  <ul className="mt-1 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                    {customerResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomer(c);
                            setCustomerQuery("");
                            setCustomerResults([]);
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                        >
                          <span>
                            <span className="font-medium text-slate-900">{c.name}</span>
                            {c.phone ? (
                              <span className="text-slate-500"> · {c.phone}</span>
                            ) : null}
                          </span>
                          <span className="text-xs text-slate-500">
                            Credit: {formatPKR(c.creditBalance || 0, settings.currency)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setShowQuickAdd((v) => !v)}
                  className="link mt-2 text-sm"
                >
                  {showQuickAdd ? "Hide quick-add" : "+ Add new customer"}
                </button>
                {showQuickAdd && (
                  <form onSubmit={quickAddCustomer} className="mt-3 space-y-3">
                    <div>
                      <label htmlFor="pos-qa-name" className="label">
                        Name (required)
                      </label>
                      <input
                        id="pos-qa-name"
                        type="text"
                        value={quickAdd.name}
                        onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                        placeholder="Name (required)"
                        className="input"
                      />
                    </div>
                    <div>
                      <label htmlFor="pos-qa-phone" className="label">
                        Phone (optional)
                      </label>
                      <input
                        id="pos-qa-phone"
                        type="text"
                        value={quickAdd.phone}
                        onChange={(e) => setQuickAdd({ ...quickAdd, phone: e.target.value })}
                        placeholder="Phone (optional)"
                        className="input"
                      />
                    </div>
                    <div>
                      <label htmlFor="pos-qa-address" className="label">
                        Address (optional)
                      </label>
                      <input
                        id="pos-qa-address"
                        type="text"
                        value={quickAdd.address}
                        onChange={(e) => setQuickAdd({ ...quickAdd, address: e.target.value })}
                        placeholder="Address (optional)"
                        className="input"
                      />
                    </div>
                    {quickAddError && (
                      <p className="form-error">{quickAddError}</p>
                    )}
                    <button type="submit" className="btn btn-primary btn-sm">
                      Save & select customer
                    </button>
                  </form>
                )}
              </>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="pos-rx" className="label">
                  Prescription ref (optional)
                </label>
                <input
                  id="pos-rx"
                  type="text"
                  value={prescriptionRef}
                  onChange={(e) => setPrescriptionRef(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="pos-doctor" className="label">
                  Doctor name (optional)
                </label>
                <input
                  id="pos-doctor"
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ---- Right: cart + totals + payment ---- */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <div className="card card-pad">
            <h2 className="text-sm font-semibold text-slate-900">Cart</h2>
            {cart.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Cart is empty. Search a medicine and press Enter to add it.
              </p>
            ) : (
              <ul className="mt-2 space-y-4">
                {calcs.map(({ line, err, qty, gross, total }) => {
                  const days = daysToExpiry(line.expiryDate);
                  const nearExpiry =
                    days !== null && days <= Number(settings.expiryWarningDays);
                  return (
                    <li key={line.key} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{line.medicineName}</p>
                          {canOverrideBatch ? (
                            <label className="mt-1 block text-xs text-slate-500">
                              Batch
                              <select
                                value={line.batchId}
                                onChange={(e) => changeBatch(line, e.target.value)}
                                className="input input-sm ml-2 w-auto"
                              >
                                {line.batches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.batchNo} · exp {new Date(b.expiryDate).toLocaleDateString("en-GB")} · {b.quantity} left
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Batch {line.batchNo} · Exp{" "}
                              {new Date(line.expiryDate).toLocaleDateString("en-GB")}
                            </p>
                          )}
                          {nearExpiry && (
                            <p className="text-xs font-medium text-amber-700">
                              Near expiry: {days === 0 ? "expires today" : `expires in ${days} day(s)`}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="shrink-0 text-sm font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="text-xs text-slate-500">
                          Qty
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.qtyDisplay}
                            onChange={(e) => updateLine(line.key, { qtyDisplay: e.target.value })}
                            className="input input-sm ml-1 w-20"
                          />
                        </label>
                        <select
                          aria-label="Unit"
                          value={line.displayUnit}
                          onChange={(e) => updateLine(line.key, { displayUnit: e.target.value })}
                          className="input input-sm w-auto"
                        >
                          {unitOptions(line).map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-500">
                          = {qty !== null ? `${qty} unit(s)` : "—"} ·{" "}
                          {formatPKR(line.unitPrice, settings.currency)}/unit
                        </span>
                        <label className="ml-auto text-xs text-slate-500">
                          Discount (Rs)
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.discount}
                            onChange={(e) => updateLine(line.key, { discount: e.target.value })}
                            className="input input-sm ml-1 w-24"
                          />
                        </label>
                      </div>
                      {err ? (
                        <p className="field-error">{err}</p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-700">
                          {formatPKR(gross, settings.currency)}
                          {Number(line.discount) > 0
                            ? ` − ${formatPKR(line.discount, settings.currency)} discount`
                            : ""}{" "}
                          = <span className="font-semibold">{formatPKR(total, settings.currency)}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card card-pad">
            <h2 className="text-sm font-semibold text-slate-900">Bill totals</h2>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatPKR(subtotal, settings.currency)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500">Bill discount</span>
                <span className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="input input-sm w-24"
                  />
                  <select
                    aria-label="Discount type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="input input-sm w-auto"
                  >
                    <option value="amount">Rs</option>
                    <option value="percent">%</option>
                  </select>
                  <span>= {formatPKR(resolvedDiscount, settings.currency)}</span>
                </span>
              </div>
              {discountError && (
                <p className="field-error text-right">{discountError}</p>
              )}
              {settings.taxEnabled && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax ({settings.taxRate}%)</span>
                  <span>{formatPKR(tax, settings.currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-xl font-bold text-slate-900">
                <span>Grand total</span>
                <span>{formatPKR(grandTotal, settings.currency)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="label">Payment method</span>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handlePaymentChange(m)}
                      aria-pressed={paymentMethod === m}
                      className={paymentMethod === m ? "pill pill-active" : "pill"}
                    >
                      {m === "Credit" ? "Credit (Udhaar)" : m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod !== "Credit" && (
                <>
                  <label className="label">
                    Amount received
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={String(grandTotal)}
                      className="input mt-1"
                    />
                  </label>
                  {receivedValid && received >= grandTotal ? (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
                      Change due:{" "}
                      <span className="font-semibold">{formatPKR(changeDue, settings.currency)}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-700">
                      Still due:{" "}
                      <span className="font-semibold">
                        {formatPKR(round2(grandTotal - (receivedValid ? received : 0)), settings.currency)}
                      </span>
                    </p>
                  )}
                </>
              )}

              {creditBlocked && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                  Credit sales need a selected customer. Search or add a customer first.
                </p>
              )}
              {creditWarning && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                  Warning: this customer&apos;s credit after this bill (
                  {formatPKR(Number(customer.creditBalance || 0) + grandTotal, settings.currency)})
                  would pass the warning limit (
                  {formatPKR(settings.creditWarnAt, settings.currency)}).
                </p>
              )}

              <button
                type="button"
                onClick={submitBill}
                disabled={!canSubmit}
                className="btn btn-primary btn-lg btn-block"
              >
                {submitting ? "Saving…" : `Save bill · ${formatPKR(grandTotal, settings.currency)}`}
              </button>
              <p className="text-center text-xs text-slate-500">
                <Link href="/sales" className="link">
                  View sales history
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
