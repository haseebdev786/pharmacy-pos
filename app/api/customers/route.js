// SAVE AS: pharmacy-pos/app/api/customers/route.js
// FROZEN CONTRACT (Phase 3 depends on this shape — do not change):
//   GET  /api/customers?q=  -> [{id, name, phone, address, notes,
//                                creditBalance}], name asc, any role.
//   POST /api/customers     -> created customer (201), any role
//                                (cashier quick-add from the POS).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const CUSTOMER_FIELDS = {
  id: true,
  name: true,
  phone: true,
  address: true,
  notes: true,
  creditBalance: true,
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = cleanString(searchParams.get("q"));

    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      select: CUSTOMER_FIELDS,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(customers);
  } catch (err) {
    console.error("GET /api/customers failed:", err);
    return NextResponse.json(
      { error: "Could not load customers." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
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
      { error: "Customer name is required." },
      { status: 400 }
    );
  }

  try {
    // creditBalance is NEVER accepted from the body: it is server-owned
    // and only moves via credit sales, returns and payments. A client
    // sending it (by mistake or on purpose) must not set a balance.
    const customer = await prisma.customer.create({
      data: {
        name,
        phone: cleanString(body.phone) || null,
        address: cleanString(body.address) || null,
        notes: cleanString(body.notes) || null,
      },
      select: CUSTOMER_FIELDS,
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers failed:", err);
    return NextResponse.json(
      { error: "Could not create customer." },
      { status: 500 }
    );
  }
}
