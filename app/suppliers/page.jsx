// SAVE AS: pharmacy-pos/app/suppliers/page.jsx
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatPKR, round2 } from "@/lib/format";
import SupplierForm from "@/components/SupplierForm";
import { PageHeader } from "@/components/ui.jsx";


const PHARMACIST_PLUS = ["admin", "pharmacist"];

export default async function SuppliersPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, PHARMACIST_PLUS)) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <PageHeader title="Suppliers" />
          <p className="card card-pad text-sm text-slate-600">
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
        <PageHeader
          title="Suppliers"
          description="Distributors you buy stock from, and what is still due to each."
        />

        <div className="card card-pad">
          <h2 className="section-title">Add supplier</h2>
          <SupplierForm />
        </div>

        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, company or phone…"
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
              href="/suppliers"
              className="btn btn-secondary"
            >
              Clear
            </a>
          ) : null}
        </form>

        {suppliers.length === 0 ? (
          <p className="card card-pad text-sm text-slate-600">
            {q
              ? `No suppliers match "${q}".`
              : "No suppliers yet. Add your first supplier above."}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th className="text-right">Total due</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => {
                  const totalDue = dueBySupplier.get(s.id) ?? 0;
                  return (
                    <tr key={s.id}>
                      <td className="font-medium text-slate-900">{s.name}</td>
                      <td className="text-slate-600">{s.company || "-"}</td>
                      <td className="text-slate-600">{s.phone || "-"}</td>
                      <td className="text-slate-600">{s.email || "-"}</td>
                      <td
                        className={`text-right font-medium ${
                          totalDue > 0 ? "text-red-600" : "text-slate-900"
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
