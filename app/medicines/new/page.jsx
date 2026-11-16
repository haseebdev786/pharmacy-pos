// SAVE AS: pharmacy-pos/app/medicines/new/page.jsx
// Create-medicine page: pharmacist+ only. Other signed-in users get
// an access-denied message inside the shell and no data is fetched.
import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import MedicineForm from "@/components/MedicineForm";

export const instant = false;

export default async function NewMedicinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, ["admin", "pharmacist"])) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Access denied</h1>
          <p className="text-sm text-gray-500">
            Only pharmacists and admins can add medicines.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Add medicine</h1>
        <MedicineForm medicine={null} onCancelHref="/medicines" />
      </div>
    </AppShell>
  );
}
