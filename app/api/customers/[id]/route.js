// SAVE AS: pharmacy-pos/app/api/customers/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            billNo: true,
            grandTotal: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { createdBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(customer);
  } catch (err) {
    console.error("GET /api/customers/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not load customer." },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // ONLY name/phone/address/notes are updatable here. creditBalance sent
  // in the body is ignored on purpose: the balance is server-owned and
  // only changes through credit sales, returns and recorded payments.
  // Letting an edit overwrite it would silently erase real udhaar.
  const data = {};
  if (body?.name !== undefined) {
    const name = cleanString(body.name);
    if (!name) {
      return NextResponse.json(
        { error: "Customer name cannot be empty." },
        { status: 400 }
      );
    }
    data.name = name;
  }
  for (const field of ["phone", "address", "notes"]) {
    if (body?.[field] !== undefined) {
      data[field] = cleanString(body[field]) || null;
    }
  }

  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const customer = await prisma.customer.update({
      where: { id },
      data,
    });
    return NextResponse.json(customer);
  } catch (err) {
    console.error("PUT /api/customers/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not update customer." },
      { status: 500 }
    );
  }
}
