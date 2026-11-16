// SAVE AS: pharmacy-pos/lib/reports-data.js
// Server-only report helpers. Every helper takes the Prisma client as its
// first argument (db), mirroring the lib/inventory-data.js convention —
// callers pass the shared `prisma` from lib/prisma.js. All money outputs
// go through round2(). Expiry is compared at day granularity (local
// midnight). No demo/fake numbers: everything is aggregated from live
// SQLite rows. Voided sales are excluded from every sales figure.
import { round2 } from "./format";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Sales summary for non-voided sales with createdAt in [from, to).
 * @param {object} db - Prisma client.
 * @param {Date} from - Inclusive range start.
 * @param {Date} to - Exclusive range end.
 * @returns {{bills:number, grossSales:number, discounts:number, tax:number, grandTotal:number, itemsSold:number}}
 *   grossSales is the sum of Sale.subtotal; itemsSold is the sum of
 *   SaleItem.qtyBaseUnits (base units, e.g. single tablets).
 */
export async function getSalesSummary(db, from, to) {
  const sales = await db.sale.findMany({
    where: { status: { not: "voided" }, createdAt: { gte: from, lt: to } },
    select: {
      subtotal: true,
      discount: true,
      tax: true,
      grandTotal: true,
      items: { select: { qtyBaseUnits: true } },
    },
  });

  let grossSales = 0;
  let discounts = 0;
  let tax = 0;
  let grandTotal = 0;
  let itemsSold = 0;
  for (const sale of sales) {
    grossSales += sale.subtotal;
    discounts += sale.discount;
    tax += sale.tax;
    grandTotal += sale.grandTotal;
    for (const item of sale.items) itemsSold += item.qtyBaseUnits;
  }

  return {
    bills: sales.length,
    grossSales: round2(grossSales),
    discounts: round2(discounts),
    tax: round2(tax),
    grandTotal: round2(grandTotal),
    itemsSold,
  };
}

/**
 * Profit report for [from, to). salesProfit is the sum over sale items of
 * non-voided sales in range of (total - purchasePrice x qtyBaseUnits),
 * minus the sum of bill-level sale discounts in range. expensesTotal is
 * the sum of Expense.amount with date in range. netProfit is
 * round2(salesProfit - expensesTotal). SaleItem has no createdAt, so
 * items are filtered via their Sale.createdAt.
 * @param {object} db - Prisma client.
 * @param {Date} from - Inclusive range start.
 * @param {Date} to - Exclusive range end.
 * @returns {{salesProfit:number, expensesTotal:number, netProfit:number, grossSales:number, discounts:number, tax:number}}
 */
export async function getProfitReport(db, from, to) {
  const [sales, expenses] = await Promise.all([
    db.sale.findMany({
      where: { status: { not: "voided" }, createdAt: { gte: from, lt: to } },
      select: {
        subtotal: true,
        discount: true,
        tax: true,
        items: {
          select: { total: true, purchasePrice: true, qtyBaseUnits: true },
        },
      },
    }),
    db.expense.findMany({
      where: { date: { gte: from, lt: to } },
      select: { amount: true },
    }),
  ]);

  let itemMargin = 0;
  let grossSales = 0;
  let discounts = 0;
  let tax = 0;
  for (const sale of sales) {
    grossSales += sale.subtotal;
    discounts += sale.discount;
    tax += sale.tax;
    for (const item of sale.items) {
      itemMargin += item.total - item.purchasePrice * item.qtyBaseUnits;
    }
  }
  let expensesTotal = 0;
  for (const expense of expenses) expensesTotal += expense.amount;

  const salesProfit = round2(itemMargin - discounts);
  expensesTotal = round2(expensesTotal);

  return {
    salesProfit,
    expensesTotal,
    netProfit: round2(salesProfit - expensesTotal),
    grossSales: round2(grossSales),
    discounts: round2(discounts),
    tax: round2(tax),
  };
}

/**
 * Best-selling medicines for non-voided sales in [from, to), ordered by
 * base units sold descending.
 * @param {object} db - Prisma client.
 * @param {Date} from - Inclusive range start.
 * @param {Date} to - Exclusive range end.
 * @param {number} [limit=10] - Maximum rows to return.
 * @returns {Array<{medicineId:string, medicineName:string, qtyBaseUnits:number, revenue:number}>}
 */
export async function getTopSelling(db, from, to, limit = 10) {
  const sales = await db.sale.findMany({
    where: { status: { not: "voided" }, createdAt: { gte: from, lt: to } },
    select: {
      items: {
        select: {
          medicineId: true,
          qtyBaseUnits: true,
          total: true,
          medicine: { select: { name: true } },
        },
      },
    },
  });

  const byMedicine = new Map();
  for (const sale of sales) {
    for (const item of sale.items) {
      const row = byMedicine.get(item.medicineId) ?? {
        medicineId: item.medicineId,
        medicineName: item.medicine.name,
        qtyBaseUnits: 0,
        revenue: 0,
      };
      row.qtyBaseUnits += item.qtyBaseUnits;
      row.revenue += item.total;
      byMedicine.set(item.medicineId, row);
    }
  }

  return [...byMedicine.values()]
    .sort((a, b) => b.qtyBaseUnits - a.qtyBaseUnits)
    .slice(0, limit)
    .map((row) => ({ ...row, revenue: round2(row.revenue) }));
}

/**
 * Expiry report at day granularity (local midnight). `expiring` holds
 * batches with stock whose expiry falls in [today, today + days);
 * `expired` holds batches with stock whose expiry is before today.
 * @param {object} db - Prisma client.
 * @param {number} days - Warning window in days.
 * @returns {{expiring:Array<{batchId:string, batchNo:string, expiryDate:Date, quantity:number, medicineName:string}>, expired:Array<{batchId:string, batchNo:string, expiryDate:Date, quantity:number, medicineName:string}>}}
 */
export async function getExpiryReport(db, days) {
  const today = startOfToday();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + days);

  const batches = await db.batch.findMany({
    where: { quantity: { gt: 0 } },
    select: {
      id: true,
      batchNo: true,
      expiryDate: true,
      quantity: true,
      medicine: { select: { name: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  const expiring = [];
  const expired = [];
  for (const batch of batches) {
    const expiryDay = startOfDay(batch.expiryDate);
    const row = {
      batchId: batch.id,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantity: batch.quantity,
      medicineName: batch.medicine.name,
    };
    if (expiryDay < today) expired.push(row);
    else if (expiryDay < horizon) expiring.push(row);
  }
  return { expiring, expired };
}

/**
 * Low-stock report: active medicines whose total stock across all batches
 * is at or below their reorder level, ordered by total stock ascending.
 * @param {object} db - Prisma client.
 * @returns {Array<{medicineId:string, name:string, totalStock:number, reorderLevel:number}>}
 */
export async function getLowStockReport(db) {
  const medicines = await db.medicine.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      reorderLevel: true,
      batches: { select: { quantity: true } },
    },
  });

  const rows = [];
  for (const medicine of medicines) {
    let totalStock = 0;
    for (const batch of medicine.batches) totalStock += batch.quantity;
    if (totalStock <= medicine.reorderLevel) {
      rows.push({
        medicineId: medicine.id,
        name: medicine.name,
        totalStock,
        reorderLevel: medicine.reorderLevel,
      });
    }
  }
  rows.sort((a, b) => a.totalStock - b.totalStock);
  return rows;
}

/**
 * Supplier dues: suppliers with outstanding Purchase.due above zero,
 * ordered by total due descending. purchaseCount counts only purchases
 * that still have an amount due.
 * @param {object} db - Prisma client.
 * @returns {Array<{supplierId:string, supplierName:string, totalDue:number, purchaseCount:number}>}
 */
export async function getSupplierDues(db) {
  const purchases = await db.purchase.findMany({
    where: { due: { gt: 0 } },
    select: {
      supplierId: true,
      due: true,
      supplier: { select: { name: true } },
    },
  });

  const bySupplier = new Map();
  for (const purchase of purchases) {
    const row = bySupplier.get(purchase.supplierId) ?? {
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier.name,
      totalDue: 0,
      purchaseCount: 0,
    };
    row.totalDue += purchase.due;
    row.purchaseCount += 1;
    bySupplier.set(purchase.supplierId, row);
  }

  return [...bySupplier.values()]
    .filter((row) => row.totalDue > 0)
    .sort((a, b) => b.totalDue - a.totalDue)
    .map((row) => ({ ...row, totalDue: round2(row.totalDue) }));
}

/**
 * Customer credit (udhaar) report: customers with a credit balance above
 * zero, ordered by balance descending.
 * @param {object} db - Prisma client.
 * @returns {Array<{customerId:string, name:string, phone:string|null, creditBalance:number}>}
 */
export async function getCustomerCreditReport(db) {
  const customers = await db.customer.findMany({
    where: { creditBalance: { gt: 0 } },
    select: { id: true, name: true, phone: true, creditBalance: true },
    orderBy: { creditBalance: "desc" },
  });

  return customers.map((customer) => ({
    customerId: customer.id,
    name: customer.name,
    phone: customer.phone,
    creditBalance: round2(customer.creditBalance),
  }));
}

/**
 * Cashier-wise sales for non-voided sales in [from, to), ordered by
 * grand total descending.
 * @param {object} db - Prisma client.
 * @param {Date} from - Inclusive range start.
 * @param {Date} to - Exclusive range end.
 * @returns {Array<{cashierId:string, cashierName:string, bills:number, grandTotal:number}>}
 */
export async function getCashierSales(db, from, to) {
  const sales = await db.sale.findMany({
    where: { status: { not: "voided" }, createdAt: { gte: from, lt: to } },
    select: {
      cashierId: true,
      grandTotal: true,
      cashier: { select: { name: true } },
    },
  });

  const byCashier = new Map();
  for (const sale of sales) {
    const row = byCashier.get(sale.cashierId) ?? {
      cashierId: sale.cashierId,
      cashierName: sale.cashier.name,
      bills: 0,
      grandTotal: 0,
    };
    row.bills += 1;
    row.grandTotal += sale.grandTotal;
    byCashier.set(sale.cashierId, row);
  }

  return [...byCashier.values()]
    .sort((a, b) => b.grandTotal - a.grandTotal)
    .map((row) => ({ ...row, grandTotal: round2(row.grandTotal) }));
}
