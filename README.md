# Pharmacy POS

Offline-first point of sale for a single pharmacy. The shop PC runs the
server and the database. Phones, tablets and other PCs on the shop WiFi
use the same system — **no internet needed inside the shop**.

Stack: Next.js 16 (App Router, JavaScript) + SQLite via Prisma 6 +
Better Auth + Tailwind CSS v4. No other dependencies.

## What it does (V1)

- Dashboard: today's sales/profit, low stock, expiring/expired batches,
  top-selling medicines, recent sales.
- Medicines + batches: FEFO selling (earliest-expiry first), expired
  batches can never be sold, stock adjustments with reasons.
- POS billing: fast search (name / generic / barcode), strips + loose
  units, discounts, tax from Settings, Cash / Card / Bank / JazzCash /
  EasyPaisa / Credit, 80mm receipt print.
- Suppliers + purchases (GRN creates batches + stock movements),
  customers + credit (udhaar) + payments, returns + Admin-only void.
- Expenses, reports (daily / profit / top-selling / expiry / low-stock /
  supplier dues / customer credit / cashier-wise), settings, users.
- Roles: Admin (everything), Pharmacist, Cashier. Every API route checks
  the session + role on the server.

## Setup (on the shop PC)

```bash
git clone https://github.com/haseebdev786/pharmacy-pos.git
cd pharmacy-pos
npm install
cp .env.example .env
```

Edit `.env` and set a fresh secret (run this command and paste ONLY its
output — never share it, never commit `.env`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then create the database and load demo data:

```bash
npx prisma migrate dev --name init
npm run seed
```

> **Prisma 6 pin — do not skip this.** Install exactly `prisma@6` and
> `@prisma/client@6` (already pinned with `^6` in `package.json`). Never
> install bare `prisma` — the latest major (Prisma 8) has an
> incompatible CLI and this schema uses the Prisma 6 client generator.
> Check with `npx prisma --version`: it must show 6.x.

## Run

For PC-only use:

```bash
npm run dev
```

Open http://localhost:3000

For PC + mobile/tablet over the shop WiFi (LAN):

```bash
npx next dev -H 0.0.0.0 -p 3000
```

1. Keep the shop PC ON while the shop is open — it is the server.
2. Connect the phone to the SAME WiFi router as the PC. The router does
   not need an internet package; it only has to provide the local
   network. (Without a router, the PC's mobile hotspot works too.)
3. On the PC, find its local address: Windows `ipconfig` (IPv4 Address),
   e.g. `192.168.1.10`.
4. On the phone browser open `http://192.168.1.10:3000` (your PC's
   address). If Windows Firewall asks, allow Node.js.
5. Sign in with the same accounts as on the PC.

Honest limit: phones work **inside the shop** on the same WiFi. There
is no access from home or another city without internet + cloud sync
(not in V1).

For day-to-day shop use, prefer a production build once testing passes:

```bash
npm run build
npx next start -H 0.0.0.0 -p 3000
```

## First sign-in

No users are seeded. Open the app, go to **Create the first account**,
and sign up: **the first account in a fresh database automatically
becomes Admin**. Later accounts start as Cashier until an Admin
promotes them on the Users page.

The seed script loads clearly labelled DEMO data only (1 supplier,
3 medicines, 4 batches, 1 customer — batch B-101 expires in 20 days on
purpose). Sales stay at a real 0 until a real bill is made. To start
clean: stop the server, delete `prisma/dev.db`, run `migrate dev`
again, and skip the seed.

## Backup — read this

The whole database is ONE file: `prisma/dev.db`. If the PC hard disk
dies and there is no backup, the data is gone.

- Copy `prisma/dev.db` to a USB drive / another PC **daily**, with the
  server stopped for a guaranteed-consistent copy.
- The Settings page also has a **Download backup** button (Admin only).
  It downloads the live file while the server runs — best-effort; a
  stopped-server file copy is the reliable backup.

## Manual test flow

1. Sign up (first account = Admin). Dashboard shows demo counts.
2. Medicines: add a medicine, check its batches and total stock.
3. Purchases: create a purchase (GRN) — batches + stock increase.
4. POS: sell from the earliest-expiry batch, print the receipt.
5. Try selling an expired batch — it must be blocked.
6. Customers: sell on Credit, then record a payment; balance falls.
7. Sales detail: return part of a bill — stock returns to the same
   batch. Void (Admin) restores the rest.
8. Reports: totals must match the sales list for the same day.
9. Settings: change store name/tax, then check the receipt + POS totals.
10. Users: sign up a second account (Cashier), promote it to
    Pharmacist, verify menus and API access change.

## Out of scope (V1)

Multi-branch, cloud sync / remote access, online orders, e-prescription
upload, barcode label printing, SMS/WhatsApp alerts, accounting
integration, native mobile app.
