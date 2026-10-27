import { NextResponse, type NextRequest } from "next/server";
import { q, one } from "@/lib/db";
import { authorized, clean, denied, params, rupees } from "@/lib/http";
import { shopForCall } from "@/lib/agent";
import { setOutcome, type Sku } from "@/lib/shops";
import { parseItems, totals } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Tool: place_order. Items as "CODE:qty, CODE:qty".
 * Calling it again in the same call replaces that call's order, so the agent can fix mistakes.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return denied();
  const p = await params(req);
  const raw = clean(p.items);
  if (!raw) {
    return NextResponse.json({ status: "need_items", say: "Ask what they want to order, with quantities." });
  }

  const { shop, executionId } = await shopForCall(p);
  const [skus, account] = await Promise.all([
    q<Sku>("select * from products where distributor_id = $1", [shop.distributor_id]),
    one<{ delivery_note: string }>("select delivery_note from distributors where id = $1", [shop.distributor_id]),
  ]);
  const { lines, problems } = parseItems(raw, skus);

  if (!lines.length) {
    return NextResponse.json({
      status: "not_placed",
      problems,
      say: "Nothing was booked. Sort out the problems with the shopkeeper, then call place_order again with the full list.",
    });
  }

  const t = totals(lines);
  // Re-placing on the same call replaces the order, but never one the warehouse has already started packing.
  const order = await one<{ id: number }>(
    `insert into orders (distributor_id, shop_id, execution_id, lines, subtotal, discount, total, source)
     values ($1, $2, $3, $4::jsonb, $5, $6, $7, 'call')
     on conflict (execution_id) where execution_id is not null
     do update set lines = excluded.lines, subtotal = excluded.subtotal, discount = excluded.discount,
                   total = excluded.total, created_at = now()
       where orders.status = 'new'
     returning id`,
    [shop.distributor_id, shop.id, executionId, JSON.stringify(lines), t.subtotal, t.discount, t.total],
  );
  if (!order) {
    return NextResponse.json({ status: "locked", say: "This order is already being packed, so it can't be changed on this call. Say the distributor will call back about changes." });
  }
  await setOutcome(executionId, "ordered");

  const readBack = lines.map((l) => `${l.qty} ${l.pack.split(" ")[0]} ${l.name}`).join(", ");
  const delivery = account?.delivery_note ? ` Delivery: ${account.delivery_note}.` : "";
  return NextResponse.json({
    status: "placed",
    order_number: `B-${1000 + order.id}`,
    lines: lines.map((l) => ({ code: l.code, name: l.name, qty: l.qty, pack: l.pack, line_total_rupees: l.total, scheme_applied: l.off > 0 })),
    discount_rupees: t.discount,
    total_rupees: t.total,
    problems,
    say:
      `Booked: ${readBack}. Total ${rupees(t.total)}` +
      (t.discount ? ` after ${rupees(t.discount)} scheme discount` : "") +
      "." + delivery +
      (problems.length ? " Some items were not booked; tell them why." : ""),
  });
}
