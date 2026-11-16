// SAVE AS: pharmacy-pos/app/purchases/[id]/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";

export const instant = false;

const PHARMACIST_PLUS = ["admin", "pharmacist"];

export default async function PurchaseDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, PHARMACIST_PLUS)) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Purchase</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            Access denied. Only pharmacists and admins can view purchases.
          </p>
        </div>
      </AppShell>
    );
  }

  const { id } = await params;

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: { medicine: { select: { id: true, name: true } } },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!purchase) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Purchase not found</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            This purchase does not exist or was removed.{" "}
            <Link href="/purchases" className="font-medium text-gray-900 underline">
              Back to purchases
            </Link>
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <div>
          <Link href="/purchases" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            ← All purchases
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Purchase from {purchase.supplier.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {formatDate(purchase.date)}
            {purchase.invoiceNo ? ` · Invoice ${purchase.invoiceNo}` : ""}
            {` · Status: ${purchase.status}`}
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-gray-100 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Supplier</p>
            <p className="mt-1 font-medium text-gray-900">{purchase.supplier.name}</p>
            {purchase.supplier.company ? (
              <p className="text-gray-600">{purchase.supplier.company}</p>
            ) : null}
            {purchase.supplier.phone ? (
              <p className="text-gray-600">{purchase.supplier.phone}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Recorded by</p>
            <p className="mt-1 font-medium text-gray-900">{purchase.createdBy.name}</p>
            <p className="text-gray-600">{formatDate(purchase.createdAt)}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Medicine</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3 text-right">Qty (units)</th>
                <th className="px-4 py-3 text-right">Purchase price</th>
                <th className="px-4 py-3 text-right">Sale price</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.medicine.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.batchNo}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(item.expiryDate)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{item.qtyBaseUnits}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatPKR(item.purchasePrice)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatPKR(item.salePrice)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatPKR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1 rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-gray-100">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">{formatPKR(purchase.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Discount</span>
            <span className="font-medium text-gray-900">− {formatPKR(purchase.discount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-1">
            <span className="font-medium text-gray-900">Total</span>
            <span className="font-bold text-gray-900">{formatPKR(purchase.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Paid</span>
            <span className="font-medium text-gray-900">{formatPKR(purchase.paid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-900">Due</span>
            <span className={`font-bold ${purchase.due > 0 ? "text-red-600" : "text-gray-900"}`}>
              {formatPKR(purchase.due)}
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
