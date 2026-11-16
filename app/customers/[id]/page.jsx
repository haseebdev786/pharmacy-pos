// SAVE AS: pharmacy-pos/app/customers/[id]/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";
import CustomerForm from "@/components/CustomerForm";
import CustomerPaymentForm from "@/components/CustomerPaymentForm";

export const instant = false;

export default async function CustomerDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          billNo: true,
          grandTotal: true,
          status: true,
          paymentMethod: true,
          createdAt: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { id: true, name: true } } },
      },
    },
  });

  if (!customer) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Customer not found</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            This customer does not exist or was removed.{" "}
            <Link href="/customers" className="font-medium text-gray-900 underline">
              Back to customers
            </Link>
          </p>
        </div>
      </AppShell>
    );
  }

  // Plain props only for client components (no Date objects).
  const customerFormProps = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    notes: customer.notes,
  };

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <div>
          <Link href="/customers" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            ← All customers
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {[customer.phone, customer.address].filter(Boolean).join(" · ") ||
              "No contact details saved."}
          </p>
          {customer.notes ? (
            <p className="mt-1 text-sm text-gray-500">{customer.notes}</p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Credit balance (udhaar)
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              customer.creditBalance > 0 ? "text-red-600" : "text-gray-900"
            }`}
          >
            {formatPKR(customer.creditBalance)}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="font-semibold text-gray-900">Edit customer</h2>
            <CustomerForm customer={customerFormProps} />
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="font-semibold text-gray-900">Record a payment</h2>
            <CustomerPaymentForm
              customerId={customer.id}
              creditBalance={customer.creditBalance}
            />
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Recent bills</h2>
          {customer.sales.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
              No bills for this customer yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Bill</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/sales/${sale.id}`}
                          className="font-medium text-gray-900 underline-offset-2 hover:underline"
                        >
                          {sale.billNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(sale.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-600">{sale.paymentMethod}</td>
                      <td className="px-4 py-3 text-gray-600">{sale.status}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatPKR(sale.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Payments received</h2>
          {customer.payments.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
              No payments recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3">Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 text-gray-600">{formatDate(payment.createdAt)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatPKR(payment.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{payment.method}</td>
                      <td className="px-4 py-3 text-gray-600">{payment.note || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{payment.createdBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
