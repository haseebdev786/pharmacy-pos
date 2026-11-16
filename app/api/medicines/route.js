// SAVE AS: pharmacy-pos/app/api/medicines/route.js
// GET: any signed-in user. POST: pharmacist+ only (admin, pharmacist).
// List GET returns a JSON array; POST returns the created medicine (201).
// Errors are always { error: "..." } with the proper status.
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

const BATCH_SELECT = {
  id: true,
  batchNo: true,
  expiryDate: true,
  quantity: true,
  salePrice: true,
  purchasePrice: true,
};

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status });
}

// SQLite note: Prisma `contains` on SQLite uses LIKE, which is
// case-insensitive for ASCII text, so plain `contains` already gives
// case-insensitive search here. `mode: "insensitive"` is NOT passed:
// the SQLite provider does not support it.
function searchFilter(q) {
  const term = String(q ?? "").trim();
  if (!term) return {};
  return {
    OR: [
      { name: { contains: term } },
      { genericName: { contains: term } },
      { barcode: { contains: term } },
      { sku: { contains: term } },
    ],
  };
}

function withTotalStock(medicine) {
  const batches = medicine.batches ?? [];
  return {
    ...medicine,
    batches,
    totalStock: batches.reduce((sum, b) => sum + b.quantity, 0),
  };
}

// Empty string (or missing) -> null, so optional unique fields
// (barcode, sku) never store "" and never collide with each other.
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

// Validates POST/PUT bodies. Returns { data } on success or
// { error } with a plain message. `partial` (PUT) only validates and
// returns fields actually present in the body, so partial updates
// like PUT { isActive: true } work. (Kept module-local: route files
// must not export non-handler functions. The [id] route carries its
// own copy of this same validation.)
function validateMedicineInput(body, partial) {
  const data = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "Medicine name is required." };
    data.name = name;
  }

  if (!partial || body.form !== undefined) {
    if (!FORMS.includes(body.form)) {
      return { error: `Form must be one of: ${FORMS.join(", ")}.` };
    }
    data.form = body.form;
  }

  for (const field of ["genericName", "manufacturer", "strength", "category"]) {
    if (!partial || body[field] !== undefined) {
      data[field] = emptyToNull(body[field]);
    }
  }

  if (!partial || body.unit !== undefined) {
    if (body.unit === undefined || body.unit === null || body.unit === "") {
      if (!partial) data.unit = "strip";
    } else {
      const unit = String(body.unit).trim();
      if (!UNITS.includes(unit)) {
        return { error: `Unit must be one of: ${UNITS.join(", ")}.` };
      }
      data.unit = unit;
    }
  }

  if (!partial || body.unitsPerStrip !== undefined) {
    if (body.unitsPerStrip === undefined || body.unitsPerStrip === null || body.unitsPerStrip === "") {
      if (!partial) data.unitsPerStrip = 1;
    } else {
      const n = parseWholeNumber(body.unitsPerStrip);
      if (n === null || n < 1) {
        return { error: "Units per strip must be a whole number of 1 or more." };
      }
      data.unitsPerStrip = n;
    }
  }

  for (const field of ["barcode", "sku"]) {
    if (!partial || body[field] !== undefined) {
      data[field] = emptyToNull(body[field]);
    }
  }

  if (!partial || body.reorderLevel !== undefined) {
    if (body.reorderLevel === undefined || body.reorderLevel === null || body.reorderLevel === "") {
      if (!partial) data.reorderLevel = 0;
    } else {
      const n = parseWholeNumber(body.reorderLevel);
      if (n === null || n < 0) {
        return { error: "Reorder level must be a whole number of 0 or more." };
      }
      data.reorderLevel = n;
    }
  }

  if (!partial || body.requiresPrescription !== undefined) {
    if (body.requiresPrescription === undefined || body.requiresPrescription === null) {
      if (!partial) data.requiresPrescription = false;
    } else if (typeof body.requiresPrescription !== "boolean") {
      return { error: "Requires prescription must be true or false." };
    } else {
      data.requiresPrescription = body.requiresPrescription;
    }
  }

  // isActive is only honoured on PUT (reactivation). New medicines
  // are always created active.
  if (partial && body.isActive !== undefined) {
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

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const includeInactive = searchParams.get("includeInactive") === "true";

  const medicines = await prisma.medicine.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...searchFilter(q),
    },
    include: {
      batches: { select: BATCH_SELECT, orderBy: { expiryDate: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(medicines.map(withTotalStock));
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("Not signed in.", 401);
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return errorResponse("Only pharmacists and admins can add medicines.", 403);
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

  const { data, error } = validateMedicineInput(body, false);
  if (error) return errorResponse(error, 400);

  try {
    const medicine = await prisma.medicine.create({ data });
    return NextResponse.json(medicine, { status: 201 });
  } catch (err) {
    if (err?.code === "P2002") {
      return errorResponse(uniqueViolationMessage(err), 400);
    }
    console.error("POST /api/medicines failed:", err);
    return errorResponse("Something went wrong while saving the medicine.", 500);
  }
}
