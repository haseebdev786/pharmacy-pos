// SAVE AS: pharmacy-pos/app/users/page.jsx
// Staff management. ADMIN ONLY; other roles see an access-denied
// message inside the shell (no data fetched for them). Lists every
// account with role and active state; role changes and
// activate/deactivate happen through UserActions (PUT /api/users/[id]).
// Passwords are never managed from this page.
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserActions from "@/components/UserActions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatDate } from "@/lib/format";

export const instant = false;

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, ["admin"])) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-100">
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Staff accounts, their roles, and who can sign in. Deactivated
            staff lose access immediately, even with a live session.
          </p>
        </div>

        <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900 shadow-sm ring-1 ring-amber-100">
          <p className="font-semibold">Adding new staff</p>
          <p className="mt-1">
            New staff: they sign up at /signup (starts as Cashier), then you
            promote them here. Passwords are never managed from this page.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          {users.length === 0 ? (
            <p className="text-sm text-gray-500">
              No users yet. The first account to sign up becomes Admin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium text-gray-900">
                        {row.name}
                        {row.id === user.id ? (
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            (you)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">{row.email}</td>
                      <td className="py-2 pr-3">{row.role}</td>
                      <td className="py-2 pr-3">
                        {row.isActive ? "Active" : "Deactivated"}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="py-2">
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
          <p className="mt-3 text-xs text-gray-500">
            You cannot change your own role or active status, and the last
            active Admin cannot be demoted or deactivated — these guards
            keep the shop from being locked out.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
