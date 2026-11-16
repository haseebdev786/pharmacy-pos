// SAVE AS: pharmacy-pos/app/api/suppliers/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2 } from "@/lib/format";

const PHARMACIST_PLUS = ["admin", "pharmacist"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
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
    const q = cleanString(searchParams.get("q"));

    const suppliers = await prisma.supplier.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { company: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    });

    // totalDue = sum of Purchase.due for the supplier, summed in JS so
    // the value always matches the purchase rows (no stored balance).
    const purchases = await prisma.purchase.findMany({
      select: { supplierId: true, due: true },
    });
    const dueBySupplier = new Map();
    for (const p of purchases) {
      dueBySupplier.set(
        p.supplierId,
        round2((dueBySupplier.get(p.supplierId) ?? 0) + p.due)
      );
    }

    return NextResponse.json(
      suppliers.map((s) => ({
        ...s,
        totalDue: dueBySupplier.get(s.id) ?? 0,
      }))
    );
  } catch (err) {
    console.error("GET /api/suppliers failed:", err);
    return NextResponse.json(
      { error: "Could not load suppliers." },
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

  const name = cleanString(body?.name);
  if (!name) {
    return NextResponse.json(
      { error: "Supplier name is required." },
      { status: 400 }
    );
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        name,
        phone: cleanString(body.phone) || null,
        email: cleanString(body.email) || null,
        address: cleanString(body.address) || null,
        company: cleanString(body.company) || null,
        notes: cleanString(body.notes) || null,
      },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (err) {
    console.error("POST /api/suppliers failed:", err);
    return NextResponse.json(
      { error: "Could not create supplier." },
      { status: 500 }
    );
  }
}
