// SAVE AS: pharmacy-pos/app/api/expenses/route.js
// Expenses list + create. Admin + pharmacist only; cashiers get 403.
// GET filters: ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=Rent|Salaries|
// Utilities|Transport|Other. The date range is day-granular and inclusive
// of both days: [from 00:00 local, day after `to` 00:00 local).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2 } from "@/lib/format";

const CATEGORIES = ["Rent", "Salaries", "Utilities", "Transport", "Other"];

// Parses a YYYY-MM-DD day string to local midnight, or null if invalid.
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export async function GET(request) {
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

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const category = searchParams.get("category");

  const where = {};
  if (fromParam) {
    const from = parseDay(fromParam);
    if (!from) {
      return NextResponse.json(
        { error: "Invalid from date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }
    where.date = { ...where.date, gte: from };
  }
  if (toParam) {
    const toDay = parseDay(toParam);
    if (!toDay) {
      return NextResponse.json(
        { error: "Invalid to date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }
    const exclusiveEnd = new Date(toDay);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    where.date = { ...where.date, lt: exclusiveEnd };
  }
  if (category) {
    if (!CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category." },
        { status: 400 }
      );
    }
    where.category = category;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { createdBy: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json(expenses);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ["admin", "pharmacist"])) {
    return NextResponse.json(
      { error: "Only Admin and Pharmacist can add expenses." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { category, amount, note } = body;

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: "Category is required: Rent, Salaries, Utilities, Transport or Other." },
      { status: 400 }
    );
  }
  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than 0." },
      { status: 400 }
    );
  }

  let date = new Date();
  if (body.date !== undefined && body.date !== null && body.date !== "") {
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      date = parseDay(body.date);
    } else {
      date = new Date(body.date);
    }
    if (!date || Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }
  }

  const created = await prisma.expense.create({
    data: {
      date,
      category,
      amount: round2(amountNumber),
      note: typeof note === "string" && note.trim() ? note.trim() : null,
      createdById: user.id,
    },
    include: { createdBy: { select: { name: true } } },
  });

  return NextResponse.json(created, { status: 201 });
}
