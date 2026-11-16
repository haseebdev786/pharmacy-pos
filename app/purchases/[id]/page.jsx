// SAVE AS: pharmacy-pos/app/purchases/[id]/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { PageHeader, Badge, Icon } from "@/components/ui.jsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";


const PHARMACIST_PLUS = ["admin", "pharmacist"];

export default async function PurchaseDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, PHARMACIST_PLUS)) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <PageHeader title="Purchase" />
          <p className="card card-pad text-sm text-slate-600">
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
          <PageHeader title="Purchase not found" />
          <p className="card card-pad text-sm text-slate-600">
            This purchase does not exist or was removed.{" "}
            <Link href="/purchases" className="link">
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
        <Link href="/purchases" className="link inline-flex items-center gap-1.5 text-sm">
          <Icon name="arrowLeft" className="h-4 w-4" />
          All purchases
        </Link>
        <PageHeader
          title={
            <>
              Purchase from {purchase.supplier.name}
            </>
          }
          description={
            <>
              {formatDate(purchase.date)}
              {purchase.invoiceNo ? ` · Invoice ${purchase.invoiceNo}` : ""}
              {" · Status: "}
              <Badge
                tone={
                  purchase.status === "received"
                    ? "green"
                    : purchase.status === "partial" ||
                        purchase.status === "returned"
                      ? "amber"
                      : "slate"
                }
              >
                {purchase.status}
              </Badge>
            </>
          }
        />

        <dl className="card card-pad grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Supplier</dt>
            <dd className="mt-1 font-medium text-slate-900">{purchase.supplier.name}</dd>
            {purchase.supplier.company ? (
              <dd className="text-slate-600">{purchase.supplier.company}</dd>
            ) : null}
            {purchase.supplier.phone ? (
              <dd className="text-slate-600">{purchase.supplier.phone}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Recorded by</dt>
            <dd className="mt-1 font-medium text-slate-900">{purchase.createdBy.name}</dd>
            <dd className="text-slate-600">{formatDate(purchase.createdAt)}</dd>
          </div>
        </dl>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="text-right">Qty (units)</th>
                <th className="text-right">Purchase price</th>
                <th className="text-right">Sale price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-slate-900">{item.medicine.name}</td>
                  <td>{item.batchNo}</td>
                  <td>{formatDate(item.expiryDate)}</td>
                  <td className="text-right text-slate-900">{item.qtyBaseUnits}</td>
                  <td className="text-right">{formatPKR(item.purchasePrice)}</td>
                  <td className="text-right">{formatPKR(item.salePrice)}</td>
                  <td className="text-right font-medium text-slate-900">{formatPKR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="card card-pad ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="font-medium text-slate-900">{formatPKR(purchase.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Discount</dt>
            <dd className="font-medium text-slate-900">− {formatPKR(purchase.discount)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1">
            <dt className="font-medium text-slate-900">Total</dt>
            <dd className="font-bold text-slate-900">{formatPKR(purchase.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Paid</dt>
            <dd className="font-medium text-slate-900">{formatPKR(purchase.paid)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-medium text-slate-900">Due</dt>
            <dd className={`font-bold ${purchase.due > 0 ? "text-red-600" : "text-slate-900"}`}>
              {formatPKR(purchase.due)}
            </dd>
          </div>
        </dl>
      </div>
    </AppShell>
  );
}
