// SAVE AS: pharmacy-pos/app/api/expenses/[id]/route.js
// Single expense: read (Admin + Pharmacist) and delete (Admin only).
// There is deliberately NO PUT handler: expenses are corrected by
// deleting the wrong entry and re-adding it, and only an Admin can
// delete — so a mistaken expense cannot be silently rewritten.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ["admin", "pharmacist"])) {
    return NextResponse.json(
      { error: "Only Admin and Pharmacist can view expenses." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true } } },
  });
  if (!expense) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }
  return NextResponse.json(expense);
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ["admin"])) {
    return NextResponse.json(
      { error: "Only Admin can delete expenses." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ id, deleted: true });
}
