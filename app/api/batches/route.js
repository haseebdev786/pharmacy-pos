// SAVE AS: pharmacy-pos/app/api/batches/route.js
// GET: any signed-in user (?medicineId= filters). POST: pharmacist+
// only. A manual batch entry creates the batch AND its stock movement
// in ONE transaction, so stock is never created without an audit row.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2 } from "@/lib/format";
import { startOfToday } from "@/lib/inventory-data";

const PHARMACIST_PLUS = ["admin", "pharmacist"];

const MEDICINE_SELECT = {
  id: true,
  name: true,
  unitsPerStrip: true,
  unit: true,
};

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

// Parses a date-only or datetime value and normalises it to local
// midnight, so expiry comparisons stay at day granularity. Returns
// null for anything that is not a real date.
function parseDay(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return n;
}

function parseMoney(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);

  const { searchParams } = new URL(request.url);
  const medicineId = searchParams.get("medicineId") ?? "";

  const batches = await prisma.batch.findMany({
    where: medicineId ? { medicineId } : {},
    orderBy: { expiryDate: "asc" },
    include: {
      medicine: { select: MEDICINE_SELECT },
      supplier: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(batches);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return errorResponse("Only pharmacists and admins can add batches.", 403);
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

  const medicineId = typeof body.medicineId === "string" ? body.medicineId.trim() : "";
  if (!medicineId) return errorResponse("medicineId is required.", 400);

  const batchNo = typeof body.batchNo === "string" ? body.batchNo.trim() : "";
  if (!batchNo) return errorResponse("Batch number is required.", 400);

  const expiryDate = parseDay(body.expiryDate);
  if (!expiryDate) return errorResponse("A valid expiry date is required.", 400);
  if (expiryDate < startOfToday()) {
    return errorResponse("Expiry date cannot be in the past.", 400);
  }

  let mfgDate = null;
  if (body.mfgDate !== undefined && body.mfgDate !== null && body.mfgDate !== "") {
    mfgDate = parseDay(body.mfgDate);
    if (!mfgDate) return errorResponse("Manufacturing date is not a valid date.", 400);
  }

  const quantity = parsePositiveInt(body.quantity);
  if (quantity === null || quantity <= 0) {
    return errorResponse("Quantity must be a whole number greater than 0.", 400);
  }

  const purchasePrice = parseMoney(body.purchasePrice);
  if (purchasePrice === null) {
    return errorResponse("Purchase price must be a number of 0 or more.", 400);
  }
  const salePrice = parseMoney(body.salePrice);
  if (salePrice === null) {
    return errorResponse("Sale price must be a number of 0 or more.", 400);
  }

  const supplierId =
    typeof body.supplierId === "string" && body.supplierId.trim() !== ""
      ? body.supplierId.trim()
      : null;

  const reason =
    typeof body.reason === "string" && body.reason.trim() !== ""
      ? body.reason.trim()
      : "Manual batch entry";

  const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
  if (!medicine) return errorResponse("Medicine not found.", 404);

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return errorResponse("Supplier not found.", 404);
  }

  try {
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.batch.create({
        data: {
          medicineId,
          batchNo,
          expiryDate,
          mfgDate,
          quantity,
          purchasePrice,
          salePrice,
          supplierId,
        },
        include: {
          medicine: { select: MEDICINE_SELECT },
          supplier: { select: { id: true, name: true } },
        },
      });
      await tx.stockMovement.create({
        data: {
          medicineId,
          batchId: created.id,
          type: "adjustment",
          qtyChange: quantity,
          reason,
          refType: "manual",
          createdById: user.id,
        },
      });
      return created;
    });
    return NextResponse.json(batch, { status: 201 });
  } catch (err) {
    if (err?.code === "P2002") {
      return errorResponse(
        "A batch with this batch number already exists for this medicine.",
        400
      );
    }
    console.error("POST /api/batches failed:", err);
    return errorResponse("Something went wrong while saving the batch.", 500);
  }
}
