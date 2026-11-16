// SAVE AS: pharmacy-pos/app/api/purchases/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2 } from "@/lib/format";

const PHARMACIST_PLUS = ["admin", "pharmacist"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Local midnight at the start of today. Expiry is compared at day
// granularity: a batch expiring today is still sellable/receivable.
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// Optional money field: missing/empty means 0, otherwise must be a
// finite number >= 0. Returns null when invalid.
function optionalMoney(value) {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// Required money field: must be present and a finite number >= 0.
function requiredMoney(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const supplierId = cleanString(searchParams.get("supplierId"));
    const fromRaw = cleanString(searchParams.get("from"));
    const toRaw = cleanString(searchParams.get("to"));

    const where = {};
    if (supplierId) where.supplierId = supplierId;
    const dateFilter = {};
    if (fromRaw) {
      // Date-only value = start of that day; full ISO = as given.
      const from = new Date(fromRaw.length <= 10 ? `${fromRaw}T00:00:00` : fromRaw);
      if (!Number.isNaN(from.getTime())) dateFilter.gte = from;
    }
    if (toRaw) {
      // Date-only value = end of that day, so the whole day is included.
      const to = new Date(toRaw.length <= 10 ? `${toRaw}T23:59:59.999` : toRaw);
      if (!Number.isNaN(to.getTime())) dateFilter.lte = to;
    }
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json(purchases);
  } catch (err) {
    console.error("GET /api/purchases failed:", err);
    return NextResponse.json(
      { error: "Could not load purchases." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ---- Validate EVERYTHING before writing anything -------------------
  const supplierId = cleanString(body?.supplierId);
  if (!supplierId) {
    return NextResponse.json(
      { error: "supplierId is required." },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier) {
    return NextResponse.json(
      { error: "Supplier not found." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "At least one purchase line is required." },
      { status: 400 }
    );
  }

  let purchaseDate = new Date();
  if (body?.date !== undefined && body.date !== null && body.date !== "") {
    const parsed = new Date(body.date);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "date must be a valid ISO date." },
        { status: 400 }
      );
    }
    purchaseDate = parsed;
  }

  const discount = optionalMoney(body?.discount);
  if (discount === null) {
    return NextResponse.json(
      { error: "discount must be 0 or more." },
      { status: 400 }
    );
  }
  const paid = optionalMoney(body?.paid);
  if (paid === null) {
    return NextResponse.json(
      { error: "paid must be 0 or more." },
      { status: 400 }
    );
  }

  const today = startOfToday();
  const validatedLines = [];
  for (let i = 0; i < body.items.length; i++) {
    const line = body.items[i] ?? {};
    const label = `Line ${i + 1}`;

    const medicineId = cleanString(line.medicineId);
    if (!medicineId) {
      return NextResponse.json(
        { error: `${label}: medicineId is required.` },
        { status: 400 }
      );
    }
    const medicine = await prisma.medicine.findUnique({
      where: { id: medicineId },
    });
    if (!medicine) {
      return NextResponse.json(
        { error: `${label}: medicine not found.` },
        { status: 400 }
      );
    }
    if (!medicine.isActive) {
      return NextResponse.json(
        { error: `${label}: ${medicine.name} is deactivated and cannot be purchased.` },
        { status: 400 }
      );
    }

    const batchNo = cleanString(line.batchNo);
    if (!batchNo) {
      return NextResponse.json(
        { error: `${label}: batchNo is required.` },
        { status: 400 }
      );
    }

    if (line.expiryDate === undefined || line.expiryDate === null || line.expiryDate === "") {
      return NextResponse.json(
        { error: `${label}: expiryDate is required.` },
        { status: 400 }
      );
    }
    const expiryDay = parseDay(line.expiryDate);
    if (!expiryDay) {
      return NextResponse.json(
        { error: `${label}: expiryDate must be a valid date.` },
        { status: 400 }
      );
    }
    if (expiryDay < today) {
      return NextResponse.json(
        { error: `${label}: batch ${batchNo} has a past expiry date and cannot be received.` },
        { status: 400 }
      );
    }

    let mfgDate = null;
    if (line.mfgDate !== undefined && line.mfgDate !== null && line.mfgDate !== "") {
      const parsedMfg = new Date(line.mfgDate);
      if (Number.isNaN(parsedMfg.getTime())) {
        return NextResponse.json(
          { error: `${label}: mfgDate must be a valid date.` },
          { status: 400 }
        );
      }
      mfgDate = parsedMfg;
    }

    const qty = Number(line.qtyBaseUnits);
    if (
      line.qtyBaseUnits === undefined ||
      line.qtyBaseUnits === null ||
      line.qtyBaseUnits === "" ||
      !Number.isInteger(qty) ||
      qty <= 0
    ) {
      return NextResponse.json(
        { error: `${label}: qtyBaseUnits must be a whole number greater than 0.` },
        { status: 400 }
      );
    }

    const purchasePrice = requiredMoney(line.purchasePrice);
    if (purchasePrice === null) {
      return NextResponse.json(
        { error: `${label}: purchasePrice must be 0 or more.` },
        { status: 400 }
      );
    }
    const salePrice = requiredMoney(line.salePrice);
    if (salePrice === null) {
      return NextResponse.json(
        { error: `${label}: salePrice must be 0 or more.` },
        { status: 400 }
      );
    }

    validatedLines.push({
      medicineId,
      medicineName: medicine.name,
      batchNo,
      expiryDate: expiryDay,
      mfgDate,
      qtyBaseUnits: qty,
      purchasePrice,
      salePrice,
      total: round2(purchasePrice * qty),
    });
  }

  const subtotal = round2(
    validatedLines.reduce((sum, line) => sum + line.total, 0)
  );
  const discountAmount = round2(discount);
  if (discountAmount > subtotal) {
    return NextResponse.json(
      { error: "discount cannot be more than the subtotal." },
      { status: 400 }
    );
  }
  const total = round2(subtotal - discountAmount);
  const paidAmount = round2(paid);
  if (paidAmount > total) {
    return NextResponse.json(
      { error: "paid cannot be more than the total." },
      { status: 400 }
    );
  }
  const due = round2(total - paidAmount);
  const status = due <= 0 ? "received" : "partial";

  const invoiceNo = cleanString(body?.invoiceNo) || null;

  // ---- One transaction: purchase + batches + items + movements -------
  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          supplierId,
          invoiceNo,
          date: purchaseDate,
          subtotal,
          discount: discountAmount,
          total,
          paid: paidAmount,
          due,
          status,
          createdById: user.id,
        },
      });

      for (const line of validatedLines) {
        // Same (medicineId, batchNo) = same physical batch: add the new
        // quantity and refresh prices/expiry/supplier to the new GRN's
        // values. Otherwise create the batch.
        const batch = await tx.batch.upsert({
          where: {
            medicineId_batchNo: {
              medicineId: line.medicineId,
              batchNo: line.batchNo,
            },
          },
          update: {
            quantity: { increment: line.qtyBaseUnits },
            purchasePrice: line.purchasePrice,
            salePrice: line.salePrice,
            expiryDate: line.expiryDate,
            // mfgDate: only overwrite when the GRN line supplies one;
            // undefined leaves the stored value untouched.
            mfgDate: line.mfgDate ?? undefined,
            supplierId,
            purchaseId: created.id,
          },
          create: {
            medicineId: line.medicineId,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
            mfgDate: line.mfgDate,
            quantity: line.qtyBaseUnits,
            purchasePrice: line.purchasePrice,
            salePrice: line.salePrice,
            supplierId,
            purchaseId: created.id,
          },
        });

        await tx.purchaseItem.create({
          data: {
            purchaseId: created.id,
            medicineId: line.medicineId,
            batchId: batch.id,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
            qtyBaseUnits: line.qtyBaseUnits,
            purchasePrice: line.purchasePrice,
            salePrice: line.salePrice,
            total: line.total,
          },
        });

        await tx.stockMovement.create({
          data: {
            medicineId: line.medicineId,
            batchId: batch.id,
            type: "purchase",
            qtyChange: line.qtyBaseUnits,
            reason: invoiceNo || "Purchase",
            refId: created.id,
            refType: "purchase",
            createdById: user.id,
          },
        });
      }

      return created;
    });

    const full = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { medicine: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    console.error("POST /api/purchases failed:", err);
    return NextResponse.json(
      { error: "Could not save purchase." },
      { status: 500 }
    );
  }
}
