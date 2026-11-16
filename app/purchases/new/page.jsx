// SAVE AS: pharmacy-pos/app/purchases/new/page.jsx
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import PurchaseForm from "@/components/PurchaseForm";

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
          <h1 className="text-2xl font-bold text-gray-900">New purchase</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New purchase</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record a goods-received note. Saving creates or updates batches and
            stock movements in one step.
          </p>
        </div>
        <PurchaseForm suppliers={suppliers} medicines={medicines} />
      </div>
    </AppShell>
  );
}
