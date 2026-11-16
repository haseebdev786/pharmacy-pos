// SAVE AS: pharmacy-pos/app/api/sales/[id]/void/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasRole } from "@/lib/session";
import { round2 } from "@/lib/format";

const ADMIN_ONLY = ["admin"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ADMIN_ONLY)) {
    return NextResponse.json(
      { error: "Only an admin can void a sale." },
      { status: 403 }
    );
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const reason = cleanString(body?.reason);
  if (!reason) {
    return NextResponse.json(
      { error: "A reason is required to void a sale." },
      { status: 400 }
    );
  }

  // ---- Validate before writing ---------------------------------------
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: {
        include: { returnItems: { select: { qtyBaseUnits: true } } },
      },
      returns: { select: { refundTotal: true } },
    },
  });
  if (!sale) {
    return NextResponse.json({ error: "Sale not found." }, { status: 404 });
  }
  if (sale.status === "voided") {
    return NextResponse.json(
      { error: `Sale ${sale.billNo} is already voided.` },
      { status: 400 }
    );
  }

  // Only the not-yet-returned part of each line is restored: returned
  // units already went back to the batch when the return was recorded.
  const restores = sale.items
    .map((item) => {
      const alreadyReturned = item.returnItems.reduce(
        (sum, r) => sum + r.qtyBaseUnits,
        0
      );
      return {
        medicineId: item.medicineId,
        batchId: item.batchId,
        remaining: item.qtyBaseUnits - alreadyReturned,
      };
    })
    .filter((line) => line.remaining > 0);

  // What returns already refunded, from Return rows for this sale.
  const alreadyRefunded = round2(
    sale.returns.reduce((sum, r) => sum + r.refundTotal, 0)
  );

  // ---- One transaction: restore stock + void + credit ----------------
  try {
    await prisma.$transaction(async (tx) => {
      for (const line of restores) {
        // Unlike a return, a void restores stock EVEN if the batch has
        // expired since the sale. The distinction is deliberate: a
        // void is an accounting reversal ("this bill never happened"),
        // so the quantities must come back exactly as sold. Expired
        // stock is still tracked in the batch but is unsellable —
        // FEFO/billing block expired batches — so restoring it cannot
        // put expired medicine on the shelf for sale.
        await tx.batch.update({
          where: { id: line.batchId },
          data: { quantity: { increment: line.remaining } },
        });

        await tx.stockMovement.create({
          data: {
            medicineId: line.medicineId,
            batchId: line.batchId,
            type: "void-restore",
            qtyChange: line.remaining,
            reason,
            refId: sale.id,
            refType: "sale",
            createdById: user.id,
          },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: "voided", voidReason: reason },
      });

      // A credit sale put the bill on the customer's balance; returns
      // already took the refunded part off. The void removes the rest
      // (grandTotal minus what returns already refunded), floored at 0.
      if (sale.paymentMethod === "Credit" && sale.customerId) {
        const customer = await tx.customer.findUnique({
          where: { id: sale.customerId },
        });
        if (customer) {
          const reduction = Math.max(
            0,
            round2(sale.grandTotal - alreadyRefunded)
          );
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              creditBalance: Math.max(
                0,
                round2(customer.creditBalance - reduction)
              ),
            },
          });
        }
      }
    });

    const updated = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: {
          include: { medicine: { select: { id: true, name: true } } },
        },
        customer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/sales/[id]/void failed:", err);
    return NextResponse.json(
      { error: "Could not void sale." },
      { status: 500 }
    );
  }
}
