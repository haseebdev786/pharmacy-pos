// SAVE AS: pharmacy-pos/app/api/auth/[...all]/route.js
// The folder name MUST be exactly [...all] (with brackets).
// Do NOT wrap this handler in a try/catch that returns a generic message:
// a masked 503 hid the real auth error for a whole day on the JobHunt
// project. Better Auth's own errors + the terminal log are the diagnosis.
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;
export const POST = handler.POST;
