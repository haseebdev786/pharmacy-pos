// SAVE AS: pharmacy-pos/app/settings/page.jsx
// Store settings + backup. ADMIN ONLY; other roles see an access-denied
// message inside the shell (no data fetched for them). When no Setting
// row exists yet, the form shows the shared defaults and the first save
// creates the row. Settings apply immediately to billing and receipts.
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import SettingsForm from "@/components/SettingsForm";
import BackupButton from "@/components/BackupButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";

export const instant = false;

const DEFAULT_SETTINGS = {
  storeName: "My Pharmacy",
  currency: "Rs",
  taxRate: 0,
  taxEnabled: false,
  receiptFooter: "Thank you! Get well soon.",
  expiryWarningDays: 90,
  creditWarnAt: 0,
};

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, ["admin"])) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            Access denied. Only Admin can view and change settings.
          </p>
        </div>
      </AppShell>
    );
  }

  const row = await prisma.setting.findUnique({ where: { id: 1 } });

  // Plain object for the client form: editable fields only, no
  // updatedAt, no Date objects. Null address/phone/footer become "".
  const settings = {
    storeName: row?.storeName ?? DEFAULT_SETTINGS.storeName,
    address: row?.address ?? "",
    phone: row?.phone ?? "",
    currency: row?.currency ?? DEFAULT_SETTINGS.currency,
    taxRate: row?.taxRate ?? DEFAULT_SETTINGS.taxRate,
    taxEnabled: row?.taxEnabled ?? DEFAULT_SETTINGS.taxEnabled,
    receiptFooter: row?.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
    expiryWarningDays:
      row?.expiryWarningDays ?? DEFAULT_SETTINGS.expiryWarningDays,
    creditWarnAt: row?.creditWarnAt ?? DEFAULT_SETTINGS.creditWarnAt,
  };

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Store details, tax, receipt text and warning limits. These apply
            to billing and receipts as soon as they are saved.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 font-semibold text-gray-900">Store settings</h2>
          <SettingsForm settings={settings} />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 font-semibold text-gray-900">Backup</h2>
          <BackupButton />
          <div className="mt-3 space-y-2 text-sm text-gray-600">
            <p>
              The database is one file:{" "}
              <code className="rounded bg-gray-100 px-1">prisma/dev.db</code>{" "}
              on the shop PC. The button above downloads a copy of that file.
            </p>
            <p>
              This download is a best-effort copy of the live file while the
              server is running. The reliable backup is copying{" "}
              <code className="rounded bg-gray-100 px-1">prisma/dev.db</code>{" "}
              while the server is stopped.
            </p>
            <p>
              Copy every backup to a USB stick or another PC. If the shop
              PC&apos;s hard disk dies and there is no backup copy elsewhere,
              the data is gone.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 font-semibold text-gray-900">
            How the shop devices connect
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              The shop PC runs the POS server and holds the only database.
              Phones and other PCs in the shop open the POS over the shop
              WiFi using the PC&apos;s LAN address (for example{" "}
              <code className="rounded bg-gray-100 px-1">
                http://192.168.1.10:3000
              </code>
              ). This works without an internet package, as long as every
              device is on the same WiFi as the PC.
            </p>
            <p>
              The PC must stay on while the shop is open. If the PC is off,
              phones have nothing to connect to.
            </p>
            <p>
              From outside the shop (for example from home) the POS is not
              reachable without internet and cloud sync, which is not part
              of this version.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
