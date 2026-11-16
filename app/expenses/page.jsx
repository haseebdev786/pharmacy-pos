// SAVE AS: pharmacy-pos/app/expenses/page.jsx
// Expenses list + add form. Admin + pharmacist only; cashiers see an
// access-denied message inside the shell (no data fetched for them).
// Filters come from searchParams (from, to, category) via a GET form.
// The date range is day-granular and inclusive of both days:
// [from 00:00 local, day after `to` 00:00 local). Delete buttons render
// only for admins. Expenses feed the profit report (sales profit minus
// expenses in the same period).
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ExpenseForm from "@/components/ExpenseForm";
import ExpenseDeleteButton from "@/components/ExpenseDeleteButton";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { formatDate, formatPKR, round2 } from "@/lib/format";
import { PageHeader } from "@/components/ui.jsx";


const CATEGORIES = ["Rent", "Salaries", "Utilities", "Transport", "Other"];

// Parses a YYYY-MM-DD day string to local midnight, or null if invalid.
function parseDay(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export default async function ExpensesPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shellUser = { name: user.name, email: user.email, role: user.role };

  if (!hasRole(user, ["admin", "pharmacist"])) {
    return (
      <AppShell user={shellUser}>
        <div className="space-y-6">
          <PageHeader title="Expenses" />
          <p className="card card-pad text-sm text-slate-600">
            Access denied. Only Admin and Pharmacist can view expenses.
          </p>
        </div>
      </AppShell>
    );
  }

  const params = await searchParams;
  const fromParam = typeof params?.from === "string" ? params.from : "";
  const toParam = typeof params?.to === "string" ? params.to : "";
  const categoryParam =
    typeof params?.category === "string" ? params.category : "";

  const where = {};
  const from = parseDay(fromParam);
  if (from) where.date = { ...where.date, gte: from };
  const toDay = parseDay(toParam);
  if (toDay) {
    const exclusiveEnd = new Date(toDay);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    where.date = { ...where.date, lt: exclusiveEnd };
  }
  if (CATEGORIES.includes(categoryParam)) where.category = categoryParam;

  const [expenses, setting] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.setting.findUnique({ where: { id: 1 } }),
  ]);

  const currency = setting?.currency ?? "Rs";
  const total = round2(expenses.reduce((sum, item) => sum + item.amount, 0));
  const isAdmin = user.role === "admin";

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <PageHeader
          title="Expenses"
          description="Shop expenses (rent, salaries, utilities). Expenses are subtracted
            from sales profit in the profit report."
        />

        <section className="card card-pad">
          <h2 className="section-title mb-3">Add expense</h2>
          <ExpenseForm />
        </section>

        <section className="card card-pad">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="label">From</span>
              <input
                type="date"
                name="from"
                defaultValue={fromParam}
                className="input"
              />
            </label>
            <label className="block text-sm">
              <span className="label">To</span>
              <input
                type="date"
                name="to"
                defaultValue={toParam}
                className="input"
              />
            </label>
            <label className="block text-sm">
              <span className="label">Category</span>
              <select
                name="category"
                defaultValue={categoryParam}
                className="input"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="btn btn-secondary"
            >
              Filter
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">
              {expenses.length} expense{expenses.length === 1 ? "" : "s"}
              {expenses.length === 200 ? " (showing latest 200)" : ""}
            </h2>
            <p className="text-sm text-slate-600">
              Total:{" "}
              <span className="font-semibold text-slate-900">
                {formatPKR(total, currency)}
              </span>
            </p>
          </div>

          {expenses.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No expenses found for these filters. Add one above, or clear the
              filters to see all expenses.
            </p>
          ) : (
            <div className="table-wrap mt-3">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th>Added by</th>
                    <th className="text-right">Amount</th>
                    {isAdmin ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.date)}</td>
                      <td>{expense.category}</td>
                      <td className="text-slate-600">
                        {expense.note ?? "-"}
                      </td>
                      <td className="text-slate-600">
                        {expense.createdBy?.name ?? "-"}
                      </td>
                      <td className="text-right font-medium">
                        {formatPKR(expense.amount, currency)}
                      </td>
                      {isAdmin ? (
                        <td>
                          <ExpenseDeleteButton expenseId={expense.id} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            To correct a wrong expense, an Admin deletes it and it is re-added
            with the right details. Expenses cannot be edited in place.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
