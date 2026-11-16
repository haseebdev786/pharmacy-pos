// SAVE AS: pharmacy-pos/components/LogoutButton.jsx
"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="btn btn-secondary"
    >
      Logout
    </button>
  );
}
