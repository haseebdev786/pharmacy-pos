// SAVE AS: pharmacy-pos/app/api/users/[id]/route.js
// Staff role / active management. ADMIN ONLY. Updates ONLY role and
// isActive via Prisma — passwords are NEVER touched here (they live on
// the Better Auth Account model, and no password field is selected or
// written). Two lockout guards: an Admin cannot change their OWN role
// or active state, and the LAST active Admin cannot be demoted or
// deactivated.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

const ROLES = ["admin", "pharmacist", "cashier"];

export async function PUT(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ["admin"])) {
    return NextResponse.json(
      { error: "Only Admin can manage users." },
      { status: 403 }
    );
  }

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { role, isActive } = body;
  if (role === undefined && isActive === undefined) {
    return NextResponse.json(
      { error: "Nothing to update. Send role and/or isActive." },
      { status: 400 }
    );
  }
  if (role !== undefined && !ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Invalid role. Use admin, pharmacist or cashier." },
      { status: 400 }
    );
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "isActive must be true or false." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Nobody may change their own role or active state — an Admin who
  // demotes or deactivates themselves would lock the shop out.
  if (target.id === user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role or active status." },
      { status: 400 }
    );
  }

  const wouldDemote = role !== undefined && role !== "admin";
  const wouldDeactivate = isActive === false;
  if (target.role === "admin" && target.isActive && (wouldDemote || wouldDeactivate)) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "admin", isActive: true, id: { not: target.id } },
    });
    if (otherActiveAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot demote or deactivate the last active Admin." },
        { status: 400 }
      );
    }
  }

  // Only role / isActive are written. Passwords are never touched.
  const data = {};
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json(updated);
}
