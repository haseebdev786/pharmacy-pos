// SAVE AS: pharmacy-pos/app/page.js
// OVERWRITES the default create-next-app home page (same file name).
// This route reads the session, so it renders at request time.
// Do NOT add `export const instant = ...` here: that segment config is
// only valid when `cacheComponents` is enabled in next.config.mjs, and
// this app does not enable it (the build fails without it).
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";


export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
