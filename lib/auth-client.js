// SAVE AS: pharmacy-pos/lib/auth-client.js
// Better Auth, client side.
//
// NO baseURL here — on purpose, do not add one. With no baseURL the
// client calls relative paths (/api/auth/...), so the SAME build works
// on http://localhost:3000 (PC) and on http://192.168.x.x:3000 (a phone
// on the shop WiFi). A hardcoded localhost baseURL would break mobile.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({});
