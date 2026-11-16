// SAVE AS: pharmacy-pos/app/sales/[id]/receipt/page.jsx
// Standalone print page: NO AppShell, so only the 80mm receipt prints.
// Cashiers may only print their own sales; access-denied / not-found
// render as plain text with no shell.
import Link from "next/link";
import { redirect } from "next/navigation";
import Receipt from "@/components/Receipt";
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

export default async function ReceiptPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const [sale, settingRow] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            medicine: { select: { name: true } },
          },
        },
        customer: { select: { id: true, name: true } },
        cashier: { select: { id: true, name: true } },
      },
    }),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);

  if (!sale) {
    return <p className="p-6 text-sm text-gray-600">Sale not found.</p>;
  }
  if (user.role === "cashier" && sale.cashierId !== user.id) {
    return <p className="p-6 text-sm text-gray-600">Access denied.</p>;
  }

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

  // Plain serialized sale for the client Receipt component. `id` is
  // included only so the receipt's "Back to sale" link can target it.
  const salePlain = {
    id: sale.id,
    billNo: sale.billNo,
    createdAt: sale.createdAt.toISOString(),
    cashierName: sale.cashier?.name || "-",
    customerName: sale.customer?.name || "Walk-in",
    prescriptionRef: sale.prescriptionRef,
    doctorName: sale.doctorName,
    paymentMethod: sale.paymentMethod,
    amountReceived: sale.amountReceived,
    changeDue: sale.changeDue,
    subtotal: sale.subtotal,
    discount: sale.discount,
    tax: sale.tax,
    grandTotal: sale.grandTotal,
    items: sale.items.map((item) => ({
      medicineName: item.medicine.name,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate.toISOString(),
      qtyDisplay: item.qtyDisplay,
      displayUnit: item.displayUnit,
      unitPrice: item.unitPrice,
      discount: item.discount,
      total: item.total,
    })),
  };

  return (
    <div className="min-h-screen bg-white py-4">
      <div className="no-print mx-auto mb-4 flex max-w-[80mm] justify-center">
        <Link
          href={`/sales/${sale.id}`}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50"
        >
          Back to sale
        </Link>
      </div>
      <Receipt sale={salePlain} settings={settings} />
    </div>
  );
}
