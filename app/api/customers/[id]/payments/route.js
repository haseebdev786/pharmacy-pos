// SAVE AS: pharmacy-pos/app/api/customers/[id]/payments/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { round2 } from "@/lib/format";

const PAYMENT_METHODS = ["Cash", "Card", "Bank", "JazzCash", "EasyPaisa"];

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
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const payments = await prisma.customerPayment.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json(payments);
  } catch (err) {
    console.error("GET /api/customers/[id]/payments failed:", err);
    return NextResponse.json(
      { error: "Could not load payments." },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
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

  const amount = Number(body?.amount);
  if (
    body?.amount === undefined ||
    body?.amount === null ||
    body?.amount === "" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return NextResponse.json(
      { error: "amount must be greater than 0." },
      { status: 400 }
    );
  }
  const method = cleanString(body?.method);
  if (!PAYMENT_METHODS.includes(method)) {
    return NextResponse.json(
      { error: `method must be one of: ${PAYMENT_METHODS.join(", ")}.` },
      { status: 400 }
    );
  }
  const note = cleanString(body?.note) || null;
  // saleId is a plain reference (no FK in the schema); it is stored
  // as given so a payment can be linked to a bill when known.
  const saleId = cleanString(body?.saleId) || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id } });
      if (!customer) return null;

      const paymentAmount = round2(amount);
      // Overpayment is allowed (the form warns) but the balance never
      // goes below 0 — the shop does not owe the customer udhaar.
      const newBalance = Math.max(
        0,
        round2(customer.creditBalance - paymentAmount)
      );

      const payment = await tx.customerPayment.create({
        data: {
          customerId: id,
          saleId,
          amount: paymentAmount,
          method,
          note,
          createdById: user.id,
        },
      });

      await tx.customer.update({
        where: { id },
        data: { creditBalance: newBalance },
      });

      return { payment, creditBalance: newBalance };
    });

    if (!result) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ...result.payment, creditBalance: result.creditBalance },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/customers/[id]/payments failed:", err);
    return NextResponse.json(
      { error: "Could not record payment." },
      { status: 500 }
    );
  }
}
