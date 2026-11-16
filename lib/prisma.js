// SAVE AS: pharmacy-pos/lib/prisma.js
// Single shared Prisma client. The globalThis cache stops Next.js dev
// hot-reload from opening a new SQLite connection on every save.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
