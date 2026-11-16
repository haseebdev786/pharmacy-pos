// SAVE AS: pharmacy-pos/app/dashboard/page.jsx
// Upgraded dashboard: every number is a REAL count/total from SQLite.
// Cashiers see only their own sale-derived stats and lists; low-stock
// and expiry lists are the same for every role. Expiry comparisons use
// local-midnight day granularity (start of today), never raw timestamps.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2, formatPKR, formatDate, daysToExpiry } from "@/lib/format";
import { StatCard, Badge, Icon } from "@/components/ui.jsx";


// Defaults used only when no Setting row exists yet (fresh database).
// Queried directly from prisma.setting — there is no lib/settings-data.js.
const SETTING_DEFAULTS = {
  storeName: "My Pharmacy",
  currency: "Rs",
  taxRate: 0,
  taxEnabled: false,
  receiptFooter: "Thank you! Get well soon.",
  expiryWarningDays: 90,
  creditWarnAt: 0,
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const onlyOwnSales = hasRole(user, ["cashier"]);
  const cashierFilter = onlyOwnSales ? { cashierId: user.id } : {};

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  // 30 calendar days ending today (today + the previous 29 days).
  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  // 7 calendar days ending today (today + the previous 6 days).
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const settingRow = await prisma.setting.findUnique({ where: { id: 1 } });
  const settings = { ...SETTING_DEFAULTS, ...(settingRow ?? {}) };
  const currency = settings.currency;
  // Day-granularity expiry window: batches expiring today through the
  // warning day itself count as expiring soon, so the upper bound is
  // the start of the day AFTER the cutoff.
  const warningEnd = new Date(startOfToday);
  warningEnd.setDate(warningEnd.getDate() + settings.expiryWarningDays + 1);

  const [
    salesToday,
    medicineCount,
    stockSum,
    medicinesWithBatches,
    expiringBatches,
    expiredBatches,
    salesLast30,
    recentSales,
    salesLast7,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        createdAt: { gte: startOfToday, lt: startOfTomorrow },
        status: { not: "voided" },
        ...cashierFilter,
      },
      select: {
        id: true,
        discount: true,
        grandTotal: true,
        items: {
          select: { total: true, purchasePrice: true, qtyBaseUnits: true },
        },
      },
    }),
    prisma.medicine.count({ where: { isActive: true } }),
    prisma.batch.aggregate({ _sum: { quantity: true } }),
    prisma.medicine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        strength: true,
        form: true,
        reorderLevel: true,
        batches: { select: { quantity: true } },
      },
    }),
    prisma.batch.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: { gte: startOfToday, lt: warningEnd },
      },
      select: {
        id: true,
        batchNo: true,
        expiryDate: true,
        quantity: true,
        medicine: { select: { id: true, name: true, strength: true } },
      },
      orderBy: { expiryDate: "asc" },
      take: 10,
    }),
    prisma.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lt: startOfToday } },
      select: {
        id: true,
        batchNo: true,
        expiryDate: true,
        quantity: true,
        medicine: { select: { id: true, name: true, strength: true } },
      },
      orderBy: { expiryDate: "asc" },
      take: 10,
    }),
    prisma.sale.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { not: "voided" },
        ...cashierFilter,
      },
      select: {
        id: true,
        items: {
          select: {
            medicineId: true,
            qtyBaseUnits: true,
            medicine: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.sale.findMany({
      where: { ...cashierFilter },
      select: {
        id: true,
        billNo: true,
        grandTotal: true,
        status: true,
        createdAt: true,
        customer: { select: { name: true } },
        cashier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.sale.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: { not: "voided" },
        ...cashierFilter,
      },
      select: { createdAt: true, grandTotal: true },
    }),
  ]);

  // Profit formula: over today's non-voided sales, sum over sale items
  // of (item total − purchasePrice × qtyBaseUnits), minus each sale's
  // bill-level discount. Item totals already carry line discounts, so
  // line discounts are not subtracted a second time. Items sold is the
  // sum of qtyBaseUnits (base units, e.g. single tablets).
  let profitToday = 0;
  let itemsSoldToday = 0;
  let salesTotalToday = 0;
  for (const sale of salesToday) {
    salesTotalToday += sale.grandTotal;
    profitToday -= sale.discount;
    for (const item of sale.items) {
      profitToday += item.total - item.purchasePrice * item.qtyBaseUnits;
      itemsSoldToday += item.qtyBaseUnits;
    }
  }
  salesTotalToday = round2(salesTotalToday);
  profitToday = round2(profitToday);
  const billsToday = salesToday.length;
  const totalUnits = stockSum._sum.quantity ?? 0;

  // Low stock: total stock is the sum of batch quantities, computed in
  // JS (there is no stored stock total). At or below reorderLevel
  // counts, including zero-stock medicines. Lowest stock first.
  const lowStock = medicinesWithBatches
    .map((m) => ({
      ...m,
      totalStock: m.batches.reduce((sum, b) => sum + b.quantity, 0),
    }))
    .filter((m) => m.totalStock <= m.reorderLevel)
    .sort((a, b) => a.totalStock - b.totalStock)
    .slice(0, 10);

  // Top-selling: SaleItem has no createdAt, so the last-30-days sales
  // fetched above are aggregated in JS by medicine.
  const soldByMedicine = new Map();
  for (const sale of salesLast30) {
    for (const item of sale.items) {
      const entry = soldByMedicine.get(item.medicineId) ?? {
        medicineId: item.medicineId,
        name: item.medicine?.name ?? "Unknown medicine",
        qty: 0,
      };
      entry.qty += item.qtyBaseUnits;
      soldByMedicine.set(item.medicineId, entry);
    }
  }
  const topSelling = [...soldByMedicine.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // 7-day daily totals, oldest day first, keyed by local calendar date.
  const dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  };
  const dailyTotals = new Map();
  for (const sale of salesLast7) {
    const key = dayKey(sale.createdAt);
    dailyTotals.set(key, round2((dailyTotals.get(key) ?? 0) + sale.grandTotal));
  }
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(startOfToday);
    day.setDate(day.getDate() - i);
    last7Days.push({ date: day, total: dailyTotals.get(dayKey(day)) ?? 0 });
  }
  const maxDayTotal = Math.max(0, ...last7Days.map((d) => d.total));
  const has7DaySales = maxDayTotal > 0;

  const stats = [
    { label: "Sales today", value: formatPKR(salesTotalToday, currency), icon: "cash", tone: "default" },
    { label: "Profit today", value: formatPKR(profitToday, currency), icon: "chart", tone: "default" },
    { label: "Bills today", value: String(billsToday), icon: "receipt", tone: "slate" },
    { label: "Items sold today", value: String(itemsSoldToday), icon: "package", tone: "slate" },
    { label: "Medicines (active)", value: String(medicineCount), icon: "pill", tone: "slate" },
    { label: "Total units in stock", value: String(totalUnits), icon: "archive", tone: "slate" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">
          Assalam-o-Alaikum, {user.name}
        </h1>
        <p className="page-desc">
          {user.email} · Role:{" "}
          <span className="font-medium text-slate-900">{user.role}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/pos" className="btn btn-primary">
            <Icon name="cart" className="h-4 w-4" />
            Open POS
          </Link>
          <Link href="/medicines" className="btn btn-secondary">
            <Icon name="pill" className="h-4 w-4" />
            Medicines
          </Link>
          <Link href="/inventory" className="btn btn-secondary">
            <Icon name="archive" className="h-4 w-4" />
            Inventory
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            icon={s.icon}
            tone={s.tone}
          />
        ))}
      </div>
      {billsToday === 0 && (
        <p className="text-sm text-slate-500">No sales yet today.</p>
      )}

      <div className="card card-pad">
        <h2 className="section-title">Sales — last 7 days</h2>
        {has7DaySales ? (
          <div className="mt-4 space-y-3">
            {last7Days.map((d) => (
              <div key={dayKey(d.date)} className="flex items-center gap-3">
                <p className="w-24 shrink-0 text-sm text-slate-500">
                  {d.date.toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{
                      width: `${maxDayTotal > 0 ? (d.total / maxDayTotal) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="w-28 shrink-0 text-right text-sm font-medium text-slate-900">
                  {formatPKR(d.total, currency)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No sales in the last 7 days.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad">
          <h2 className="section-title">Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No low-stock medicines. All active medicines are above their
              reorder level.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {lowStock.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/medicines/${m.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {m.name}
                    {m.strength ? ` ${m.strength}` : ""}
                  </Link>
                  <p className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-sm text-slate-500">
                    {m.totalStock === 0 ? (
                      <Badge tone="red">Out of stock</Badge>
                    ) : (
                      <span>{`${m.totalStock} units left`}</span>
                    )}
                    <span>· reorder at {m.reorderLevel}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/inventory" className="link mt-3 inline-block text-sm">
            View inventory
          </Link>
        </div>

        <div className="card card-pad">
          <h2 className="section-title">
            Expiring soon (next {settings.expiryWarningDays} days)
          </h2>
          {expiringBatches.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No batches expiring in the next {settings.expiryWarningDays} days.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {expiringBatches.map((b) => {
                const days = daysToExpiry(b.expiryDate);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <Link
                        href={`/medicines/${b.medicine.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {b.medicine.name}
                        {b.medicine.strength ? ` ${b.medicine.strength}` : ""}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Batch {b.batchNo} · {b.quantity} units · expires{" "}
                        {formatDate(b.expiryDate)}
                      </p>
                    </div>
                    <Badge tone="amber" className="shrink-0">
                      {days === 0 ? "Expires today" : `${days} days left`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/inventory" className="link mt-3 inline-block text-sm">
            View inventory
          </Link>
        </div>

        <div className="card card-pad">
          <h2 className="section-title">Expired stock</h2>
          <p className="section-desc">
            Expired stock must never be sold.
          </p>
          {expiredBatches.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No expired stock with quantity on hand.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {expiredBatches.map((b) => {
                const days = daysToExpiry(b.expiryDate);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <Link
                        href={`/medicines/${b.medicine.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {b.medicine.name}
                        {b.medicine.strength ? ` ${b.medicine.strength}` : ""}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Batch {b.batchNo} · {b.quantity} units · expired{" "}
                        {formatDate(b.expiryDate)}
                      </p>
                    </div>
                    <Badge tone="red" className="shrink-0">
                      Expired {days !== null ? `${Math.abs(days)} days ago` : ""}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/inventory" className="link mt-3 inline-block text-sm">
            View inventory
          </Link>
        </div>

        <div className="card card-pad">
          <h2 className="section-title">
            Top-selling medicines (last 30 days)
          </h2>
          {topSelling.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No sales in the last 30 days.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {topSelling.map((m, i) => (
                <li key={m.medicineId} className="flex items-center justify-between gap-3 py-2">
                  <p className="text-sm text-slate-900">
                    <span className="mr-2 text-slate-400">{i + 1}.</span>
                    <Link
                      href={`/medicines/${m.medicineId}`}
                      className="font-medium hover:underline"
                    >
                      {m.name}
                    </Link>
                  </p>
                  <p className="shrink-0 text-sm text-slate-500">
                    {m.qty} units sold
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="section-title">Recent sales</h2>
        {recentSales.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No sales yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {recentSales.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div>
                  <Link
                    href={`/sales/${s.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {s.billNo}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {s.customer?.name ?? "Walk-in"} · {s.cashier?.name ?? "-"} ·{" "}
                    {formatDate(s.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    tone={
                      s.status === "voided"
                        ? "red"
                        : s.status === "completed"
                          ? "green"
                          : "amber"
                    }
                  >
                    {s.status}
                  </Badge>
                  <p className="text-sm font-medium text-slate-900">
                    {formatPKR(s.grandTotal, currency)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/sales" className="link mt-3 inline-block text-sm">
          View all sales
        </Link>
      </div>
    </div>
  );
}
