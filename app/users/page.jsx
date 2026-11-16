// SAVE AS: pharmacy-pos/app/users/page.jsx
// Staff management. ADMIN ONLY; other roles see an access-denied
// message inside the shell (no data fetched for them). Lists every
// account with role and active state; role changes and
// activate/deactivate happen through UserActions (PUT /api/users/[id]).
// Passwords are never managed from this page.
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserActions from "@/components/UserActions";
import { PageHeader, Badge, roleTone } from "@/components/ui.jsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatDate } from "@/lib/format";


export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, ["admin"])) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <PageHeader title="Users" />
          <p className="card card-pad text-sm text-slate-600">
            Access denied. Only Admin can manage users.
          </p>
        </div>
      </AppShell>
    );
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Staff accounts, their roles, and who can sign in. Deactivated staff lose access immediately, even with a live session."
        />

        <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900 shadow-sm ring-1 ring-amber-100">
          <p className="font-semibold">Adding new staff</p>
          <p className="mt-1">
            New staff: they sign up at /signup (starts as Cashier), then you
            promote them here. Passwords are never managed from this page.
          </p>
        </div>

        <section className="card card-pad">
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">
              No users yet. The first account to sign up becomes Admin.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium text-slate-900">
                        {row.name}
                        {row.id === user.id ? (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (you)
                          </span>
                        ) : null}
                      </td>
                      <td className="text-slate-600">{row.email}</td>
                      <td>
                        <Badge tone={roleTone(row.role)} className="capitalize">
                          {row.role}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={row.isActive ? "emerald" : "slate"}>
                          {row.isActive ? "Active" : "Deactivated"}
                        </Badge>
                      </td>
                      <td className="text-slate-600">
                        {formatDate(row.createdAt)}
                      </td>
                      <td>
                        <UserActions
                          user={{
                            id: row.id,
                            name: row.name,
                            email: row.email,
                            role: row.role,
                            isActive: row.isActive,
                          }}
                          currentUserId={user.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            You cannot change your own role or active status, and the last
            active Admin cannot be demoted or deactivated — these guards
            keep the shop from being locked out.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
