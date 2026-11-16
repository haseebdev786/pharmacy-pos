// SAVE AS: pharmacy-pos/components/LogoutButton.jsx
"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Icon } from "@/components/ui.jsx";

export default function LogoutButton({ className, variant }) {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const dark = variant === "dark";
  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`${dark ? "side-logout" : "btn btn-secondary"}${className ? ` ${className}` : ""}`}
    >
      {dark && <Icon name="logout" className="h-4 w-4" />}
      Logout
    </button>
  );
}
