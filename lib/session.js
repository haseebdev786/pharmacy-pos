// SAVE AS: pharmacy-pos/lib/session.js
// Server-only helpers. Import from server components and API routes only.
// The role is ALWAYS re-read from SQLite here, never trusted from the
// session cookie copy — so an Admin changing someone's role (or
// deactivating them) takes effect on their very next request.
import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  // Deactivated staff lose access immediately, even with a live session.
  if (!user || !user.isActive) return null;
  return user;
}

export function hasRole(user, roles) {
  return !!user && roles.includes(user.role);
}
