// SAVE AS: pharmacy-pos/app/customers/[id]/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatPKR, formatDate } from "@/lib/format";
import CustomerForm from "@/components/CustomerForm";
import CustomerPaymentForm from "@/components/CustomerPaymentForm";
import { PageHeader, Badge, Icon } from "@/components/ui.jsx";


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
          <PageHeader title="Customer not found" />
          <p className="card card-pad text-sm text-slate-600">
            This customer does not exist or was removed.{" "}
            <Link href="/customers" className="link">
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
        <Link href="/customers" className="link inline-flex items-center gap-1.5 text-sm">
          <Icon name="arrowLeft" className="h-4 w-4" />
          All customers
        </Link>
        <PageHeader
          title={customer.name}
          description={
            <>
              {[customer.phone, customer.address].filter(Boolean).join(" · ") ||
                "No contact details saved."}
              {customer.notes ? (
                <p className="mt-1">{customer.notes}</p>
              ) : null}
            </>
          }
        />

        <div className="card card-pad">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Credit balance (udhaar)
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              customer.creditBalance > 0 ? "text-red-600" : "text-slate-900"
            }`}
          >
            {formatPKR(customer.creditBalance)}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card card-pad">
            <h2 className="section-title">Edit customer</h2>
            <CustomerForm customer={customerFormProps} />
          </div>
          <div className="card card-pad">
            <h2 className="section-title">Record a payment</h2>
            <CustomerPaymentForm
              customerId={customer.id}
              creditBalance={customer.creditBalance}
            />
          </div>
        </div>

        <div>
          <h2 className="section-title mb-3">Recent bills</h2>
          {customer.sales.length === 0 ? (
            <p className="card card-pad text-sm text-slate-600">
              No bills for this customer yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Bill</th>
                    <th>Date</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="link"
                        >
                          {sale.billNo}
                        </Link>
                      </td>
                      <td>{formatDate(sale.createdAt)}</td>
                      <td>{sale.paymentMethod}</td>
                      <td>
                        <Badge
                          tone={
                            sale.status === "voided"
                              ? "red"
                              : sale.status === "completed"
                                ? "green"
                                : "amber"
                          }
                        >
                          {sale.status}
                        </Badge>
                      </td>
                      <td className="text-right font-medium text-slate-900">
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
          <h2 className="section-title mb-3">Payments received</h2>
          {customer.payments.length === 0 ? (
            <p className="card card-pad text-sm text-slate-600">
              No payments recorded yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Amount</th>
                    <th>Method</th>
                    <th>Note</th>
                    <th>Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.createdAt)}</td>
                      <td className="text-right font-medium text-slate-900">
                        {formatPKR(payment.amount)}
                      </td>
                      <td>{payment.method}</td>
                      <td>{payment.note || "-"}</td>
                      <td>{payment.createdBy.name}</td>
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
