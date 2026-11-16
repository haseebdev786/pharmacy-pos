// SAVE AS: pharmacy-pos/app/page.js
// OVERWRITES the default create-next-app home page (same file name).
// instant = false: this route reads the session, so it must render at
// request time. Next 16 + cacheComponents rejects `dynamic =
// "force-dynamic"` here — instant = false is the blocking declaration
// that replaced it on the JobHunt project.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export const instant = false;

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
