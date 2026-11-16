// SAVE AS: pharmacy-pos/app/purchases/new/page.jsx
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import PurchaseForm from "@/components/PurchaseForm";
import Link from "next/link";
import { PageHeader, Icon } from "@/components/ui.jsx";

export const instant = false;

const PHARMACIST_PLUS = ["admin", "pharmacist"];

export default async function NewPurchasePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, PHARMACIST_PLUS)) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <PageHeader title="New purchase" />
          <p className="card card-pad text-sm text-slate-600">
            Access denied. Only pharmacists and admins can record purchases.
          </p>
        </div>
      </AppShell>
    );
  }

  const [suppliers, medicines] = await Promise.all([
    prisma.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.medicine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        genericName: true,
        strength: true,
        form: true,
        unit: true,
        unitsPerStrip: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <Link href="/purchases" className="link inline-flex items-center gap-1.5 text-sm">
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to purchases
        </Link>
        <PageHeader
          title="New purchase"
          description="Record a goods-received note. Saving creates or updates batches and
            stock movements in one step."
        />
        <PurchaseForm suppliers={suppliers} medicines={medicines} />
      </div>
    </AppShell>
  );
}
