// SAVE AS: pharmacy-pos/app/api/medicines/[id]/route.js
// GET: any signed-in user — medicine + batches + totalStock + the 20
// most recent stock movements. PUT/DELETE: pharmacist+ only.
// DELETE never hard-deletes: it sets isActive=false (deactivation).
// Reactivate with PUT { isActive: true }.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

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
const PHARMACIST_PLUS = ["admin", "pharmacist"];

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function parseWholeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return n;
}

// Same validation as POST /api/medicines, in partial-update form:
// only fields actually present in the body are validated and returned,
// so PUT { isActive: true } reactivates without touching anything else.
// (Duplicated here on purpose: route files must not export helpers,
// and no shared validation file is in the Phase 2 file list.)
function validateMedicineUpdate(body) {
  const data = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "Medicine name is required." };
    data.name = name;
  }

  if (body.form !== undefined) {
    if (!FORMS.includes(body.form)) {
      return { error: `Form must be one of: ${FORMS.join(", ")}.` };
    }
    data.form = body.form;
  }

  for (const field of ["genericName", "manufacturer", "strength", "category"]) {
    if (body[field] !== undefined) {
      data[field] = emptyToNull(body[field]);
    }
  }

  if (body.unit !== undefined) {
    const unit = String(body.unit ?? "").trim();
    if (!UNITS.includes(unit)) {
      return { error: `Unit must be one of: ${UNITS.join(", ")}.` };
    }
    data.unit = unit;
  }

  if (body.unitsPerStrip !== undefined) {
    const n = parseWholeNumber(body.unitsPerStrip);
    if (n === null || n < 1) {
      return { error: "Units per strip must be a whole number of 1 or more." };
    }
    data.unitsPerStrip = n;
  }

  for (const field of ["barcode", "sku"]) {
    if (body[field] !== undefined) {
      data[field] = emptyToNull(body[field]);
    }
  }

  if (body.reorderLevel !== undefined) {
    const n = parseWholeNumber(body.reorderLevel);
    if (n === null || n < 0) {
      return { error: "Reorder level must be a whole number of 0 or more." };
    }
    data.reorderLevel = n;
  }

  if (body.requiresPrescription !== undefined) {
    if (typeof body.requiresPrescription !== "boolean") {
      return { error: "Requires prescription must be true or false." };
    }
    data.requiresPrescription = body.requiresPrescription;
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { error: "isActive must be true or false." };
    }
    data.isActive = body.isActive;
  }

  return { data };
}

function uniqueViolationMessage(err) {
  const target = err?.meta?.target;
  const fields = Array.isArray(target) ? target : [];
  if (fields.includes("barcode")) {
    return "A medicine with this barcode already exists.";
  }
  if (fields.includes("sku")) {
    return "A medicine with this SKU already exists.";
  }
  return "A medicine with this barcode or SKU already exists.";
}

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);
  const { id } = await params;

  const medicine = await prisma.medicine.findUnique({
    where: { id },
    include: {
      batches: {
        orderBy: { expiryDate: "asc" },
        include: { supplier: { select: { id: true, name: true } } },
      },
    },
  });
  if (!medicine) return errorResponse("Medicine not found.", 404);

  const recentMovements = await prisma.stockMovement.findMany({
    where: { medicineId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      batch: { select: { id: true, batchNo: true, expiryDate: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    ...medicine,
    totalStock: medicine.batches.reduce((sum, b) => sum + b.quantity, 0),
    recentMovements,
  });
}

export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return errorResponse("Only pharmacists and admins can edit medicines.", 403);
  }
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }
  if (!body || typeof body !== "object") {
    return errorResponse("Invalid request body.", 400);
  }

  const { data, error } = validateMedicineUpdate(body);
  if (error) return errorResponse(error, 400);
  if (Object.keys(data).length === 0) {
    return errorResponse("No fields to update.", 400);
  }

  const existing = await prisma.medicine.findUnique({ where: { id } });
  if (!existing) return errorResponse("Medicine not found.", 404);

  try {
    const updated = await prisma.medicine.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    if (err?.code === "P2002") {
      return errorResponse(uniqueViolationMessage(err), 400);
    }
    console.error("PUT /api/medicines/[id] failed:", err);
    return errorResponse("Something went wrong while saving the medicine.", 500);
  }
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return errorResponse("Only pharmacists and admins can deactivate medicines.", 403);
  }
  const { id } = await params;

  const existing = await prisma.medicine.findUnique({ where: { id } });
  if (!existing) return errorResponse("Medicine not found.", 404);

  // NEVER hard-delete a medicine: sales, purchases and stock movements
  // reference it, and deleting it would rewrite history. Deactivation
  // hides it from new bills while keeping every record intact.
  // Reactivate with PUT { isActive: true }.
  const updated = await prisma.medicine.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json(updated);
}
