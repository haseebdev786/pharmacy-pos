// SAVE AS: pharmacy-pos/app/api/settings/route.js
// Store settings (single Setting row, id 1). GET is open to ANY
// authenticated role — the POS screen and receipts need the store name,
// currency, tax and footer to bill and print. PUT is ADMIN ONLY.
// GET never creates the row: when no row exists it returns the defaults
// object below, so a fresh install bills with sensible values until an
// Admin saves settings for the first time. Phase 3 (POS/receipt)
// consumes this GET by this exact contract.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

const DEFAULT_SETTINGS = {
  storeName: "My Pharmacy",
  currency: "Rs",
  taxRate: 0,
  taxEnabled: false,
  receiptFooter: "Thank you! Get well soon.",
  expiryWarningDays: 90,
  creditWarnAt: 0,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  // Do NOT create the row on GET — return the defaults object as-is.
  return NextResponse.json(settings ?? DEFAULT_SETTINGS);
}

export async function PUT(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ["admin"])) {
    return NextResponse.json(
      { error: "Only Admin can change settings." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { storeName, address, phone, currency, taxRate, taxEnabled, receiptFooter, expiryWarningDays, creditWarnAt } = body;

  if (typeof storeName !== "string" || !storeName.trim()) {
    return NextResponse.json(
      { error: "Store name is required." },
      { status: 400 }
    );
  }
  if (typeof currency !== "string" || !currency.trim()) {
    return NextResponse.json(
      { error: "Currency is required." },
      { status: 400 }
    );
  }
  const taxRateNumber = Number(taxRate);
  if (!Number.isFinite(taxRateNumber) || taxRateNumber < 0) {
    return NextResponse.json(
      { error: "Tax rate must be a number of 0 or more." },
      { status: 400 }
    );
  }
  if (typeof taxEnabled !== "boolean") {
    return NextResponse.json(
      { error: "taxEnabled must be true or false." },
      { status: 400 }
    );
  }
  const expiryWarningDaysNumber = Number(expiryWarningDays);
  if (
    !Number.isInteger(expiryWarningDaysNumber) ||
    expiryWarningDaysNumber <= 0
  ) {
    return NextResponse.json(
      { error: "Expiry warning days must be a whole number greater than 0." },
      { status: 400 }
    );
  }
  const creditWarnAtNumber = Number(creditWarnAt);
  if (!Number.isFinite(creditWarnAtNumber) || creditWarnAtNumber < 0) {
    return NextResponse.json(
      { error: "Credit warning limit must be a number of 0 or more." },
      { status: 400 }
    );
  }

  const data = {
    storeName: storeName.trim(),
    address:
      typeof address === "string" && address.trim() ? address.trim() : null,
    phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
    currency: currency.trim(),
    taxRate: taxRateNumber,
    taxEnabled,
    receiptFooter:
      typeof receiptFooter === "string" && receiptFooter.trim()
        ? receiptFooter.trim()
        : null,
    expiryWarningDays: expiryWarningDaysNumber,
    creditWarnAt: creditWarnAtNumber,
  };

  const updated = await prisma.setting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  return NextResponse.json(updated);
}
