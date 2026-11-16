// SAVE AS: pharmacy-pos/app/suppliers/page.jsx
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, round2 } from "@/lib/format";
import SupplierForm from "@/components/SupplierForm";

export const instant = false;

const PHARMACIST_PLUS = ["admin", "pharmacist"];

export default async function SuppliersPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, PHARMACIST_PLUS)) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            Access denied. Only pharmacists and admins can view suppliers.
          </p>
        </div>
      </AppShell>
    );
  }

  const sp = await searchParams;
  const q = typeof sp?.q === "string" ? sp.q.trim() : "";

  const suppliers = await prisma.supplier.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { company: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });

  // Total due per supplier, summed in JS from live purchase rows.
  const purchases = await prisma.purchase.findMany({
    select: { supplierId: true, due: true },
  });
  const dueBySupplier = new Map();
  for (const p of purchases) {
    dueBySupplier.set(
      p.supplierId,
      round2((dueBySupplier.get(p.supplierId) ?? 0) + p.due)
    );
  }

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Distributors you buy stock from, and what is still due to each.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="font-semibold text-gray-900">Add supplier</h2>
          <SupplierForm />
        </div>

        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, company or phone…"
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
              href="/suppliers"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Clear
            </a>
          ) : null}
        </form>

        {suppliers.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
            {q
              ? `No suppliers match "${q}".`
              : "No suppliers yet. Add your first supplier above."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-right">Total due</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => {
                  const totalDue = dueBySupplier.get(s.id) ?? 0;
                  return (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.company || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{s.phone || "-"}</td>
                      <td className="px-4 py-3 text-gray-600">{s.email || "-"}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          totalDue > 0 ? "text-red-600" : "text-gray-900"
                        }`}
                      >
                        {formatPKR(totalDue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
