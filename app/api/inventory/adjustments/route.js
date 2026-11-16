// SAVE AS: pharmacy-pos/app/api/inventory/adjustments/route.js
// GET: any signed-in user — the 50 most recent stock movements.
// POST: pharmacist+ only — sets a batch to a new quantity and logs a
// stock movement, in ONE transaction. A reason is always required:
// every manual stock change must be auditable.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

const PHARMACIST_PLUS = ["admin", "pharmacist"];

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);

  const movements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      medicine: { select: { id: true, name: true } },
      batch: { select: { id: true, batchNo: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(movements);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return errorResponse("Only pharmacists and admins can adjust stock.", 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }
  if (!body || typeof body !== "object") {
    return errorResponse("Invalid request body.", 400);
  }

  const batchId = typeof body.batchId === "string" ? body.batchId.trim() : "";
  if (!batchId) return errorResponse("batchId is required.", 400);

  if (body.newQuantity === undefined || body.newQuantity === null || body.newQuantity === "") {
    return errorResponse("New quantity is required.", 400);
  }
  const newQuantity = Number(body.newQuantity);
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    return errorResponse("New quantity must be a whole number of 0 or more.", 400);
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return errorResponse("A reason is required for a stock adjustment.", 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({ where: { id: batchId } });
      if (!batch) throw httpError(404, "Batch not found.");

      const qtyChange = newQuantity - batch.quantity;
      if (qtyChange === 0) {
        throw httpError(
          400,
          "No change — new quantity is the same as the current quantity."
        );
      }

      const updatedBatch = await tx.batch.update({
        where: { id: batchId },
        data: { quantity: newQuantity },
        include: {
          medicine: { select: { id: true, name: true, unitsPerStrip: true, unit: true } },
        },
      });
      const movement = await tx.stockMovement.create({
        data: {
          medicineId: batch.medicineId,
          batchId,
          type: "adjustment",
          qtyChange,
          reason,
          refType: "manual",
          createdById: user.id,
        },
      });
      return { batch: updatedBatch, movement };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err?.status) return errorResponse(err.message, err.status);
    console.error("POST /api/inventory/adjustments failed:", err);
    return errorResponse("Something went wrong while adjusting stock.", 500);
  }
}
