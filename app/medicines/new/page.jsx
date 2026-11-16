// SAVE AS: pharmacy-pos/app/medicines/new/page.jsx
// Create-medicine page: pharmacist+ only. Other signed-in users get
// an access-denied message inside the shell and no data is fetched.
import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/session";
import AppShell from "@/components/AppShell";
import MedicineForm from "@/components/MedicineForm";
import Link from "next/link";
import { PageHeader, Icon } from "@/components/ui.jsx";


export default async function NewMedicinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, ["admin", "pharmacist"])) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <PageHeader
            title="Access denied"
            description="Only pharmacists and admins can add medicines."
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <Link href="/medicines" className="link inline-flex items-center gap-1.5 text-sm">
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to medicines
        </Link>
        <PageHeader title="Add medicine" />
        <MedicineForm medicine={null} onCancelHref="/medicines" />
      </div>
    </AppShell>
  );
}
