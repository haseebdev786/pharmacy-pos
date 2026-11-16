// SAVE AS: pharmacy-pos/app/api/sales/[id]/route.js
// Single-sale read: full bill with items, customer, cashier and returns.
// Cashiers may only read their own sales.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          medicine: { select: { name: true, unitsPerStrip: true, unit: true } },
          batch: { select: { batchNo: true } },
        },
      },
      customer: { select: { id: true, name: true, phone: true } },
      cashier: { select: { id: true, name: true } },
      returns: {
        orderBy: { createdAt: "desc" },
        include: {
          items: true,
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }
  if (user.role === "cashier" && sale.cashierId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(sale);
}
