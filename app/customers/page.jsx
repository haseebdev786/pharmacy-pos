// SAVE AS: pharmacy-pos/app/customers/page.jsx
import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatPKR } from "@/lib/format";
import CustomerForm from "@/components/CustomerForm";

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Regular customers and their credit (udhaar) balances.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="font-semibold text-gray-900">Add customer</h2>
          <CustomerForm />
        </div>

        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or phone…"
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Search
          </button>
          {q ? (
            <a
              href="/customers"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Clear
            </a>
          ) : null}
        </form>

        {customers.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            {q
              ? `No customers match "${q}".`
              : "No customers yet. Add your first customer above."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Credit balance</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-gray-900 underline-offset-2 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || "-"}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        c.creditBalance > 0 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {formatPKR(c.creditBalance)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{c._count.sales}</td>
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
