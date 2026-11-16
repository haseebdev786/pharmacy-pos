// SAVE AS: pharmacy-pos/lib/inventory-data.js
// Inventory helpers shared by Phase 2 pages/APIs and Phase 3 (POS/FEFO).
// FROZEN EXPORTS — do not rename these or change their signatures:
// Phase 3 imports these exact names. `db` is the Prisma client OR a
// transaction client and is always the first argument. Plain Prisma
// calls only, no raw SQL. Expiry comparisons are at day granularity
// (local midnight). Stock is in base units (single tablet/capsule).

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Earliest-expiry batch with stock that has not expired, or null.
// FEFO: selling always picks this batch first.
export async function getFefoBatch(db, medicineId) {
  return db.batch.findFirst({
    where: {
      medicineId,
      quantity: { gt: 0 },
      expiryDate: { gte: startOfToday() },
    },
    orderBy: { expiryDate: "asc" },
  });
}

// All batches for one medicine, earliest expiry first. The caller
// filters out expired / zero-quantity batches when it needs to.
export async function getBatchesForMedicine(db, medicineId) {
  return db.batch.findMany({
    where: { medicineId },
    orderBy: { expiryDate: "asc" },
  });
}

// Total stock = sum of all batch quantities for the medicine.
export async function getMedicineStock(db, medicineId) {
  const result = await db.batch.aggregate({
    where: { medicineId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

// Batches with stock expiring from today up to (but not including)
// today + days. Includes the medicine. Earliest expiry first.
export async function getExpiringBatches(db, days) {
  const today = startOfToday();
  const upper = new Date(today);
  upper.setDate(upper.getDate() + days);
  return db.batch.findMany({
    where: {
      quantity: { gt: 0 },
      expiryDate: { gte: today, lt: upper },
    },
    include: { medicine: true },
    orderBy: { expiryDate: "asc" },
  });
}

// Batches with stock whose expiry date has passed. Includes the
// medicine. Earliest expiry first. Expired stock can never be sold.
export async function getExpiredBatches(db) {
  return db.batch.findMany({
    where: {
      quantity: { gt: 0 },
      expiryDate: { lt: startOfToday() },
    },
    include: { medicine: true },
    orderBy: { expiryDate: "asc" },
  });
}

// Active medicines whose total stock is at or below their reorder
// level. Totals are computed in JS from medicines + batches (Prisma
// has no cross-table sum filter on SQLite). Each returned medicine
// carries an added `totalStock` number. Lowest stock first. A medicine
// with no batches has totalStock 0, so it shows here too.
export async function getLowStockMedicines(db) {
  const medicines = await db.medicine.findMany({
    where: { isActive: true },
    include: { batches: { select: { quantity: true } } },
  });
  return medicines
    .map(({ batches, ...medicine }) => ({
      ...medicine,
      totalStock: batches.reduce((sum, b) => sum + b.quantity, 0),
    }))
    .filter((m) => m.totalStock <= m.reorderLevel)
    .sort((a, b) => a.totalStock - b.totalStock);
}
