// SAVE AS: pharmacy-pos/app/pos/page.jsx
// POS billing screen (server wrapper): loads the Setting row (or the
// shared defaults when no row exists yet) and hands plain props to the
// client PosScreen. Any authenticated role may sell.
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import PosScreen from "@/components/PosScreen";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const instant = false;

const SETTING_DEFAULTS = {
  storeName: "My Pharmacy",
  address: null,
  phone: null,
  currency: "Rs",
  taxRate: 0,
  taxEnabled: false,
  receiptFooter: "Thank you! Get well soon.",
  expiryWarningDays: 90,
  creditWarnAt: 0,
};

export default async function PosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const settingRow = await prisma.setting.findUnique({ where: { id: 1 } });
  // Plain settings only — updatedAt (a Date) is deliberately omitted so
  // the object can cross the server/client boundary unchanged.
  const settings = settingRow
    ? {
        storeName: settingRow.storeName,
        address: settingRow.address,
        phone: settingRow.phone,
        currency: settingRow.currency,
        taxRate: settingRow.taxRate,
        taxEnabled: settingRow.taxEnabled,
        receiptFooter: settingRow.receiptFooter,
        expiryWarningDays: settingRow.expiryWarningDays,
        creditWarnAt: settingRow.creditWarnAt,
      }
    : { ...SETTING_DEFAULTS };

  const plainUser = { name: user.name, email: user.email, role: user.role };

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }}>
      <div className="space-y-6">
        <PosScreen user={plainUser} settings={settings} />
      </div>
    </AppShell>
  );
}
