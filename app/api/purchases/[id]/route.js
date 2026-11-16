// SAVE AS: pharmacy-pos/app/api/purchases/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

const PHARMACIST_PLUS = ["admin", "pharmacist"];

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
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: { medicine: { select: { id: true, name: true } } },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(purchase);
  } catch (err) {
    console.error("GET /api/purchases/[id] failed:", err);
    return NextResponse.json(
      { error: "Could not load purchase." },
      { status: 500 }
    );
  }
}
