// SAVE AS: pharmacy-pos/app/api/users/route.js
// Staff list. ADMIN ONLY. Returns only safe fields — never password
// hashes. The User model has no password field (passwords live on the
// Better Auth Account model); this select never touches Account.
// There is deliberately NO POST handler: staff accounts are created by
// signing up at /signup (every new account starts as Cashier, except
// the very first account, which becomes Admin), and an Admin then
// promotes them via PUT /api/users/[id].
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ["admin"])) {
    return NextResponse.json(
      { error: "Only Admin can view users." },
      { status: 403 }
    );
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}
