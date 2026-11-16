// SAVE AS: pharmacy-pos/app/api/sales/route.js
// Sales list + bill creation. Every bill is created inside ONE Prisma
// transaction: ALL lines are validated BEFORE any write, so a bill with
// insufficient stock, an expired batch, or a bad discount saves nothing.
// Prices always come from the batch server-side — the client never sets
// a price. Bill discount is accepted as an Rs amount ONLY; a discountType
// sent by the client is ignored (the client resolves % -> Rs itself).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { round2 } from "@/lib/format";

const PAYMENT_METHODS = ["Cash", "Card", "Bank", "JazzCash", "EasyPaisa", "Credit"];

const SETTING_DEFAULTS = {
  storeName: "My Pharmacy",
  currency: "Rs",
  taxRate: 0,
  taxEnabled: false,
  receiptFooter: "Thank you! Get well soon.",
  expiryWarningDays: 90,
  creditWarnAt: 0,
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const customerId = searchParams.get("customerId") || "";
  const paymentMethod = searchParams.get("paymentMethod") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const where = {};
  if (q) where.billNo = { contains: q };
  if (customerId) where.customerId = customerId;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  // Cashiers see ONLY their own sales — the cashierId param is ignored
  // for them entirely; other roles may filter by cashierId.
  if (user.role === "cashier") {
    where.cashierId = user.id;
  } else {
    const cashierId = searchParams.get("cashierId") || "";
    if (cashierId) where.cashierId = cashierId;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        where.createdAt.gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      cashier: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json(sales);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const customerId = body.customerId || null;
  const prescriptionRef =
    typeof body.prescriptionRef === "string" && body.prescriptionRef.trim()
      ? body.prescriptionRef.trim()
      : null;
  const doctorName =
    typeof body.doctorName === "string" && body.doctorName.trim()
      ? body.doctorName.trim()
      : null;
  // NOTE: discount is an Rs amount ONLY. body.discountType ("amount" |
  // "percent") is deliberately ignored — the client resolves % to Rs.
  const billDiscount = Number(body.discount) || 0;
  const paymentMethod = body.paymentMethod;
  const amountReceivedInput = Number(body.amountReceived) || 0;
  const items = body.items;

  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw validationError("A bill needs at least one item.");
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw validationError("Invalid payment method.");
    }
    if (!Number.isFinite(billDiscount) || billDiscount < 0) {
      throw validationError("Bill discount must be 0 or more.");
    }
    if (!Number.isFinite(amountReceivedInput) || amountReceivedInput < 0) {
      throw validationError("Amount received must be 0 or more.");
    }
    if (paymentMethod === "Credit" && !customerId) {
      throw validationError("A credit sale needs a customer — walk-in credit is not allowed.");
    }
    for (const [i, line] of items.entries()) {
      if (!line || typeof line !== "object") {
        throw validationError(`Line ${i + 1}: invalid item.`);
      }
      if (!line.medicineId || !line.batchId) {
        throw validationError(`Line ${i + 1}: medicine and batch are required.`);
      }
      if (!Number.isInteger(line.qtyBaseUnits) || line.qtyBaseUnits <= 0) {
        throw validationError(`Line ${i + 1}: quantity must be a whole number of units greater than 0.`);
      }
      if (!Number.isFinite(Number(line.qtyDisplay)) || Number(line.qtyDisplay) <= 0) {
        throw validationError(`Line ${i + 1}: display quantity must be greater than 0.`);
      }
      if (!line.displayUnit || typeof line.displayUnit !== "string") {
        throw validationError(`Line ${i + 1}: display unit is required.`);
      }
      const lineDiscount = Number(line.discount) || 0;
      if (!Number.isFinite(lineDiscount) || lineDiscount < 0) {
        throw validationError(`Line ${i + 1}: line discount must be 0 or more.`);
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      const today = startOfToday();

      // Settings (tax) — fall back to defaults when no Setting row exists.
      const settingRow = await tx.setting.findUnique({ where: { id: 1 } });
      const settings = { ...SETTING_DEFAULTS, ...(settingRow || {}) };

      // Customer must exist when one is named (credit or otherwise).
      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw validationError("Customer not found.");
      }

      // --- Validate ALL lines before any write. ---
      const medicineIds = [...new Set(items.map((l) => l.medicineId))];
      const batchIds = [...new Set(items.map((l) => l.batchId))];
      const [medicines, batches] = await Promise.all([
        tx.medicine.findMany({ where: { id: { in: medicineIds } } }),
        tx.batch.findMany({ where: { id: { in: batchIds } } }),
      ]);
      const medicineById = new Map(medicines.map((m) => [m.id, m]));
      const batchById = new Map(batches.map((b) => [b.id, b]));

      // Aggregate quantities per batch: several lines may share one batch,
      // and their combined quantity must fit the batch stock.
      const qtyByBatch = new Map();
      for (const line of items) {
        qtyByBatch.set(line.batchId, (qtyByBatch.get(line.batchId) || 0) + line.qtyBaseUnits);
      }
      for (const [batchId, totalQty] of qtyByBatch) {
        const batch = batchById.get(batchId);
        if (!batch) throw validationError("One of the selected batches no longer exists.");
        if (batch.quantity < totalQty) {
          throw validationError(
            `Batch ${batch.batchNo} has only ${batch.quantity} unit(s) left — the bill needs ${totalQty}.`
          );
        }
      }

      const preparedLines = items.map((line, i) => {
        const medicine = medicineById.get(line.medicineId);
        if (!medicine) throw validationError(`Line ${i + 1}: medicine not found.`);
        if (!medicine.isActive) {
          throw validationError(`Line ${i + 1}: ${medicine.name} is deactivated and cannot be sold.`);
        }
        const batch = batchById.get(line.batchId);
        if (!batch) throw validationError(`Line ${i + 1}: batch not found.`);
        if (batch.medicineId !== line.medicineId) {
          throw validationError(`Line ${i + 1}: batch ${batch.batchNo} does not belong to ${medicine.name}.`);
        }
        // Expiry at day granularity: a batch expiring today is still sellable.
        if (new Date(batch.expiryDate) < today) {
          throw validationError(`Batch ${batch.batchNo} is expired and cannot be sold.`);
        }
        // Server-side prices — NEVER trust any price the client sent.
        const unitPrice = batch.salePrice;
        const purchasePrice = batch.purchasePrice;
        const lineDiscount = round2(Number(line.discount) || 0);
        const gross = round2(unitPrice * line.qtyBaseUnits);
        if (lineDiscount >= gross) {
          throw validationError(
            `Line ${i + 1}: line discount must be less than the line total (${gross}).`
          );
        }
        return {
          medicineId: line.medicineId,
          batchId: line.batchId,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          qtyBaseUnits: line.qtyBaseUnits,
          qtyDisplay: Number(line.qtyDisplay),
          displayUnit: line.displayUnit,
          unitPrice,
          purchasePrice,
          discount: lineDiscount,
          total: round2(gross - lineDiscount),
        };
      });

      const subtotal = round2(preparedLines.reduce((sum, l) => sum + l.total, 0));
      const discount = round2(billDiscount);
      if (discount > subtotal) {
        throw validationError("Bill discount cannot be more than the subtotal.");
      }
      const tax = settings.taxEnabled
        ? round2(((subtotal - discount) * Number(settings.taxRate || 0)) / 100)
        : 0;
      const grandTotal = round2(subtotal - discount + tax);

      let amountReceived;
      let changeDue;
      let creditAmount;
      if (paymentMethod === "Credit") {
        creditAmount = grandTotal;
        amountReceived = 0;
        changeDue = 0;
      } else {
        creditAmount = 0;
        if (amountReceivedInput < grandTotal) {
          throw validationError(
            `Amount received (${amountReceivedInput}) is less than the grand total (${grandTotal}).`
          );
        }
        amountReceived = round2(amountReceivedInput);
        changeDue = round2(amountReceived - grandTotal);
      }

      // Bill number: sequential count inside the transaction. Single-server
      // SQLite, so a unique violation on a rare race just means the user
      // retries the bill (caught below as a readable 400).
      const count = await tx.sale.count();
      const billNo = "BILL-" + String(count + 1).padStart(4, "0");

      // --- Writes: sale first (its id is the movement refId), then stock. ---
      const created = await tx.sale.create({
        data: {
          billNo,
          customerId,
          subtotal,
          discount,
          tax,
          grandTotal,
          paymentMethod,
          amountReceived,
          changeDue,
          creditAmount,
          prescriptionRef,
          doctorName,
          cashierId: user.id,
          items: { create: preparedLines },
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } },
          cashier: { select: { id: true, name: true } },
        },
      });

      for (const line of preparedLines) {
        await tx.batch.update({
          where: { id: line.batchId },
          data: { quantity: { decrement: line.qtyBaseUnits } },
        });
        await tx.stockMovement.create({
          data: {
            medicineId: line.medicineId,
            batchId: line.batchId,
            type: "sale",
            qtyChange: -line.qtyBaseUnits,
            reason: billNo,
            refId: created.id,
            refType: "sale",
            createdById: user.id,
          },
        });
      }

      if (paymentMethod === "Credit") {
        await tx.customer.update({
          where: { id: customerId },
          data: { creditBalance: { increment: grandTotal } },
        });
      }

      return created;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (err) {
    if (err?.status === 400) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    // Unique violation (e.g. billNo race): ask the user to retry.
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "This bill number was just taken — please try saving the bill again." },
        { status: 400 }
      );
    }
    console.error("POST /api/sales failed:", err);
    return NextResponse.json({ error: "Failed to save the bill." }, { status: 500 });
  }
}
