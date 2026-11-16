// SAVE AS: pharmacy-pos/app/customers/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatPKR } from "@/lib/format";
import CustomerForm from "@/components/CustomerForm";
import { PageHeader } from "@/components/ui.jsx";

export const instant = false;

export default async function CustomersPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  const sp = await searchParams;
  const q = typeof sp?.q === "string" ? sp.q.trim() : "";

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    include: { _count: { select: { sales: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <PageHeader
          title="Customers"
          description="Regular customers and their credit (udhaar) balances."
        />

        <div className="card card-pad">
          <h2 className="section-title">Add customer</h2>
          <CustomerForm />
        </div>

        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or phone…"
            className="input max-w-sm"
          />
          <button
            type="submit"
            className="btn btn-secondary"
          >
            Search
          </button>
          {q ? (
            <a
              href="/customers"
              className="btn btn-secondary"
            >
              Clear
            </a>
          ) : null}
        </form>

        {customers.length === 0 ? (
          <p className="card card-pad text-sm text-slate-600">
            {q
              ? `No customers match "${q}".`
              : "No customers yet. Add your first customer above."}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th className="text-right">Credit balance</th>
                  <th className="text-right">Bills</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-slate-600">{c.phone || "-"}</td>
                    <td
                      className={`text-right font-medium ${
                        c.creditBalance > 0 ? "text-red-600" : "text-slate-900"
                      }`}
                    >
                      {formatPKR(c.creditBalance)}
                    </td>
                    <td className="text-right text-slate-600">{c._count.sales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
