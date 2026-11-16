// SAVE AS: pharmacy-pos/scripts/seed-pharmacy.mjs
// Run AFTER `npx prisma migrate dev --name init` (that creates the tables):
//   node scripts/seed-pharmacy.mjs
//
// Loads DEMO data only: settings, 1 supplier, 3 medicines + batches,
// 1 customer. No users, no sales — the first sign-up becomes Admin,
// and sales stay at a real 0 until a real bill is made.
// Seed batches are OPENING STOCK (no purchase record, no stock
// movements). Real purchases from Step 4 create the audit trail.
//
// Idempotent: if any medicine already exists, it prints a message and
// exits without changing anything. For a fresh start, delete
// prisma/dev.db, run migrate dev again, then run this script again.
//
// Env loading matches the JobHunt fix: .env first, then .env.local
// overriding it, real process.env always wins. Prisma itself only
// reads .env, so keep DATABASE_URL in .env for this project.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(file) {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

if (!process.env.DATABASE_URL) {
  console.error(
    'ERROR: DATABASE_URL is not set. Add DATABASE_URL="file:./dev.db" to .env first.'
  );
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const daysFromNow = (days) => new Date(Date.now() + days * 86400000);

async function main() {
  const existing = await prisma.medicine.count();
  if (existing > 0) {
    console.log(
      `Seed skipped: ${existing} medicine(s) already in the database. Nothing changed.`
    );
    return;
  }

  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: "Demo Pharmacy",
      address: "Demo address — change in Settings",
      phone: "0300-0000000",
      currency: "Rs",
      taxRate: 0,
      taxEnabled: false,
      receiptFooter: "Thank you! Get well soon.",
      expiryWarningDays: 90,
      creditWarnAt: 0,
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: "Demo Distributors",
      phone: "0300-0000000",
      company: "Demo Pharma Distribution",
      notes: "DEMO supplier from seed script. Replace with real suppliers.",
    },
  });

  const medicines = [
    {
      name: "Paracetamol 500mg",
      genericName: "Paracetamol",
      manufacturer: "Demo Pharma",
      strength: "500mg",
      form: "Tablet",
      category: "Pain Relief",
      unit: "strip",
      unitsPerStrip: 10,
      barcode: "DEMO-001",
      sku: "DEMO-001",
      reorderLevel: 20,
      batches: [
        { batchNo: "B-101", days: 20, qty: 100, buy: 2, sell: 3 },
        { batchNo: "B-102", days: 540, qty: 500, buy: 1.8, sell: 3 },
      ],
    },
    {
      name: "Amoxicillin 250mg",
      genericName: "Amoxicillin",
      manufacturer: "Demo Pharma",
      strength: "250mg",
      form: "Capsule",
      category: "Antibiotic",
      unit: "strip",
      unitsPerStrip: 10,
      barcode: "DEMO-002",
      sku: "DEMO-002",
      reorderLevel: 20,
      requiresPrescription: true,
      batches: [{ batchNo: "B-201", days: 300, qty: 200, buy: 5, sell: 8 }],
    },
    {
      name: "ORS Sachet",
      genericName: "Oral Rehydration Salts",
      manufacturer: "Demo Pharma",
      strength: null,
      form: "Other",
      category: "General",
      unit: "piece",
      unitsPerStrip: 1,
      barcode: "DEMO-003",
      sku: "DEMO-003",
      reorderLevel: 10,
      batches: [{ batchNo: "B-301", days: 400, qty: 50, buy: 15, sell: 25 }],
    },
  ];

  for (const m of medicines) {
    const medicine = await prisma.medicine.create({
      data: {
        name: m.name,
        genericName: m.genericName,
        manufacturer: m.manufacturer,
        strength: m.strength,
        form: m.form,
        category: m.category,
        unit: m.unit,
        unitsPerStrip: m.unitsPerStrip,
        barcode: m.barcode,
        sku: m.sku,
        reorderLevel: m.reorderLevel,
        requiresPrescription: m.requiresPrescription ?? false,
      },
    });
    for (const b of m.batches) {
      await prisma.batch.create({
        data: {
          medicineId: medicine.id,
          batchNo: b.batchNo,
          expiryDate: daysFromNow(b.days),
          quantity: b.qty,
          purchasePrice: b.buy,
          salePrice: b.sell,
          supplierId: supplier.id,
        },
      });
    }
  }

  await prisma.customer.create({
    data: {
      name: "Demo Customer",
      phone: "0300-0000000",
      notes: "DEMO customer from seed script.",
    },
  });

  console.log("Seeded DEMO data: 1 supplier, 3 medicines, 4 batches, 1 customer.");
  console.log("Batch B-101 expires in 20 days on purpose (near-expiry demo).");
  console.log("No users seeded: sign up in the app — the first account becomes Admin.");
}

try {
  await main();
} catch (err) {
  if (err?.code === "P2021" || String(err?.message || "").includes("does not exist")) {
    console.error(
      "ERROR: database tables are missing. Run `npx prisma migrate dev --name init` first, then run this seed again."
    );
  } else {
    console.error("Seed failed:", err?.message || err);
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
