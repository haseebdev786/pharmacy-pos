// SAVE AS: pharmacy-pos/app/api/suppliers/[id]/route.js
// NOTE: there is deliberately NO DELETE endpoint for suppliers.
// A supplier with purchases/batches must never disappear — deleting one
// would orphan purchase history and break supplier-due reporting.
// Keep the record; stop ordering from them instead.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2 } from "@/lib/format";

const PHARMACIST_PLUS = ["admin", "pharmacist"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found." },
        { status: 404 }
      );
    }

    const purchases = await prisma.purchase.findMany({
      where: { supplierId: id },
      orderBy: { date: "desc" },
      take: 20,
      include: { _count: { select: { items: true } } },
    });

    // totalDue must cover ALL purchases, not just the recent 20 shown.
    const allDues = await prisma.purchase.findMany({
      where: { supplierId: id },
      select: { due: true },
    });
    const totalDue = round2(allDues.reduce((sum, p) => sum + p.due, 0));

    return NextResponse.json({ ...supplier, purchases, totalDue });
  } catch (err) {
    console.error("GET /api/suppliers/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not load supplier." },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, PHARMACIST_PLUS)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Only the editable fields are accepted; anything else in the body
  // (e.g. a computed balance) is ignored.
  const data = {};
  if (body?.name !== undefined) {
    const name = cleanString(body.name);
    if (!name) {
      return NextResponse.json(
        { error: "Supplier name cannot be empty." },
        { status: 400 }
      );
    }
    data.name = name;
  }
  for (const field of ["phone", "email", "address", "company", "notes"]) {
    if (body?.[field] !== undefined) {
      data[field] = cleanString(body[field]) || null;
    }
  }

  try {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Supplier not found." },
        { status: 404 }
      );
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data,
    });
    return NextResponse.json(supplier);
  } catch (err) {
    console.error("PUT /api/suppliers/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not update supplier." },
      { status: 500 }
    );
  }
}
