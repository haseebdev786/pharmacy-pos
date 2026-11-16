// SAVE AS: pharmacy-pos/lib/auth.js
// Better Auth, server side. SQLite via the Prisma adapter.
// Secrets come from .env only (BETTER_AUTH_SECRET, BETTER_AUTH_URL).
// Never paste .env values in chat, and never commit .env.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  appName: "Pharmacy POS",
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    // Offline shop: no email server, so no email verification in V1.
    // The Admin creates staff accounts; passwords are set at sign-up.
    requireEmailVerification: false,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      // input: false = a user can NEVER set their own role from the client.
      // Only server code (the hook below, and Admin-only pages later) writes it.
      role: {
        type: "string",
        defaultValue: "cashier",
        input: false,
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // First account ever created becomes Admin (the shop owner doing
        // first setup). Every later account starts as Cashier until an
        // Admin promotes it. Runs before the write, so the role is stored
        // in the same record — no second update, no window as cashier.
        before: async (user) => {
          const count = await prisma.user.count();
          return {
            data: {
              ...user,
              role: count === 0 ? "admin" : "cashier",
            },
          };
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours — one shop day
    updateAge: 60 * 60,
  },
  // Rate limiting stays on default (memory) storage on purpose: this app
  // runs as ONE server process on the shop PC, and database storage would
  // need an extra rate-limit table in the schema. Do not switch to
  // storage: "database" without adding that table first.
  rateLimit: {
    enabled: true,
  },
  // No trustedOrigins list on purpose. The client uses relative URLs
  // (see lib/auth-client.js), so a phone on the shop WiFi talks to the
  // PC under the PC's own address — same origin, no extra trust needed.
  // If mobile login ever fails with an origin error, send the exact
  // error text back before changing anything here.
});
