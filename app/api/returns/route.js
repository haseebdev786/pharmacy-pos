// SAVE AS: pharmacy-pos/app/api/returns/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2 } from "@/lib/format";

const PHARMACIST_PLUS = ["admin", "pharmacist"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Local midnight at the start of today. Expiry is compared at day
// granularity: a batch expiring today has not expired yet.
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

  const saleId = cleanString(body?.saleId);
  if (!saleId) {
    return NextResponse.json(
      { error: "saleId is required." },
      { status: 400 }
    );
  }
  const reason = cleanString(body?.reason);
  if (!reason) {
    return NextResponse.json(
      { error: "A reason is required for a return." },
      { status: 400 }
    );
  }
  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "At least one returned item is required." },
      { status: 400 }
    );
  }

  // ---- Validate EVERYTHING before writing anything -------------------
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          returnItems: { select: { qtyBaseUnits: true } },
          medicine: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!sale) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }
  if (sale.status === "voided") {
    return NextResponse.json(
      { error: `Sale ${sale.billNo} is voided and cannot be returned.` },
      { status: 400 }
    );
  }

  const itemsById = new Map(sale.items.map((item) => [item.id, item]));

  // Combine duplicate lines for the same sale item so the remaining
  // check sees the full requested quantity, not each line alone.
  const requestedBySaleItem = new Map();
  for (let i = 0; i < body.items.length; i++) {
    const line = body.items[i] ?? {};
    const label = `Line ${i + 1}`;
    const saleItemId = cleanString(line.saleItemId);
    if (!saleItemId) {
      return NextResponse.json(
        { error: `${label}: saleItemId is required.` },
        { status: 400 }
      );
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
    const saleItem = itemsById.get(saleItemId);
    if (!saleItem) {
      return NextResponse.json(
        { error: `${label}: item does not belong to sale ${sale.billNo}.` },
        { status: 400 }
      );
    }
    requestedBySaleItem.set(
      saleItemId,
      (requestedBySaleItem.get(saleItemId) ?? 0) + qty
    );
  }

  // Already-returned quantities, from ReturnItem rows (never trusted
  // from the client).
  const alreadyReturnedByItem = new Map();
  for (const item of sale.items) {
    alreadyReturnedByItem.set(
      item.id,
      item.returnItems.reduce((sum, r) => sum + r.qtyBaseUnits, 0)
    );
  }

  // Live batch records: a batch may have expired AFTER the sale, and
  // the live expiry decides whether stock may re-enter the shelf.
  const batchIds = [...new Set(sale.items.map((item) => item.batchId))];
  const batches = await prisma.batch.findMany({
    where: { id: { in: batchIds } },
  });
  const batchById = new Map(batches.map((b) => [b.id, b]));

  const today = startOfToday();
  const validatedLines = [];
  for (const [saleItemId, qty] of requestedBySaleItem) {
    const saleItem = itemsById.get(saleItemId);
    const alreadyReturned = alreadyReturnedByItem.get(saleItemId) ?? 0;
    const remaining = saleItem.qtyBaseUnits - alreadyReturned;
    if (qty > remaining) {
      return NextResponse.json(
        {
          error: `Only ${remaining} unit(s) of ${saleItem.medicine.name} (batch ${saleItem.batchNo}) can still be returned.`,
        },
        { status: 400 }
      );
    }

    const batch = batchById.get(saleItem.batchId);
    if (!batch) {
      return NextResponse.json(
        {
          error: `Batch ${saleItem.batchNo} for ${saleItem.medicine.name} no longer exists; the return cannot be recorded.`,
        },
        { status: 400 }
      );
    }
    // EXPIRED-BATCH RULE: expired stock must NEVER re-enter sellable
    // stock. If the batch has expired since the sale, the WHOLE return
    // is rejected (no partial write) — the stock stays out of the
    // shelf and the case is handled outside the POS (supplier return
    // / write-off), not by silently restocking expired medicine.
    const batchExpiryDay = parseDay(batch.expiryDate);
    if (!batchExpiryDay || batchExpiryDay < today) {
      return NextResponse.json(
        {
          error: `Batch ${batch.batchNo} (${saleItem.medicine.name}) has expired and cannot be returned to stock. This return was rejected in full.`,
        },
        { status: 400 }
      );
    }

    // REFUND FORMULA: average net price per base unit, so the line
    // discount is shared fairly across returned units:
    //   refund = round2((item.total / item.qtyBaseUnits) * qtyReturned)
    // item.total is already net of the line discount.
    const refundAmount = round2(
      (saleItem.total / saleItem.qtyBaseUnits) * qty
    );

    validatedLines.push({
      saleItemId,
      medicineId: saleItem.medicineId,
      batchId: saleItem.batchId,
      qtyBaseUnits: qty,
      refundAmount,
    });
  }

  const refundTotal = round2(
    validatedLines.reduce((sum, line) => sum + line.refundAmount, 0)
  );

  // New sale status: fully returned only when EVERY sale item is now
  // fully returned (previous returns + this one).
  const fullyReturned = sale.items.every((item) => {
    const alreadyReturned = alreadyReturnedByItem.get(item.id) ?? 0;
    const nowReturning = requestedBySaleItem.get(item.id) ?? 0;
    return alreadyReturned + nowReturning >= item.qtyBaseUnits;
  });
  const newStatus = fullyReturned ? "returned-full" : "returned-partial";

  // ---- One transaction: return + items + stock + status + credit -----
  try {
    const created = await prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          saleId: sale.id,
          refundTotal,
          reason,
          createdById: user.id,
        },
      });

      for (const line of validatedLines) {
        await tx.returnItem.create({
          data: {
            returnId: ret.id,
            saleItemId: line.saleItemId,
            medicineId: line.medicineId,
            batchId: line.batchId,
            qtyBaseUnits: line.qtyBaseUnits,
            refundAmount: line.refundAmount,
          },
        });

        await tx.batch.update({
          where: { id: line.batchId },
          data: { quantity: { increment: line.qtyBaseUnits } },
        });

        await tx.stockMovement.create({
          data: {
            medicineId: line.medicineId,
            batchId: line.batchId,
            type: "return",
            qtyChange: line.qtyBaseUnits,
            reason,
            refId: ret.id,
            refType: "return",
            createdById: user.id,
          },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: newStatus },
      });

      // A credit (udhaar) sale put this amount on the customer's
      // balance; a return takes the refunded part back off, floored
      // at 0 so the balance never goes negative.
      if (sale.paymentMethod === "Credit" && sale.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: sale.customerId },
        });
        if (customer) {
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              creditBalance: Math.max(
                0,
                round2(customer.creditBalance - refundTotal)
              ),
            },
          });
        }
      }

      return ret;
    });

    const full = await prisma.return.findUnique({
      where: { id: created.id },
      include: {
        items: {
          include: {
            medicine: { select: { id: true, name: true } },
            batch: { select: { id: true, batchNo: true } },
          },
        },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    console.error("POST /api/returns failed:", err);
    return NextResponse.json(
      { error: "Could not record return." },
      { status: 500 }
    );
  }
}
