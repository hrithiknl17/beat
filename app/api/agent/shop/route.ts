import { NextResponse, type NextRequest } from "next/server";
import { q, one } from "@/lib/db";
import { authorized, denied, params } from "@/lib/http";
import { shopForCall } from "@/lib/agent";
import { daysSince, type Sku } from "@/lib/shops";
import type { Line } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Tool: get_shop_context. Called at the start of every call. */
async function handle(req: NextRequest) {
  if (!authorized(req)) return denied();
  const p = await params(req);
  const { shop } = await shopForCall(p);

  const last = await one<{ lines: Line[]; total: number; created_at: string }>(
    "select lines, total, created_at from orders where shop_id = $1 order by created_at desc limit 1",
    [shop.id],
  );
  const skus = await q<Sku>("select * from skus order by name");
  const overdueDays = daysSince(shop.credit_due_since);

  return NextResponse.json({
    distributor: process.env.DISTRIBUTOR_NAME ?? "Sri Ganesh Distributors",
    shop_name: shop.name,
    owner_name: shop.owner_name,
    area: shop.area,
    preferred_language: { kn: "Kannada", hi: "Hindi", en: "English" }[shop.language] ?? "Kannada",
    last_order: last
      ? {
          days_ago: daysSince(last.created_at),
          items: last.lines.map((l) => ({ code: l.code, name: l.name, qty: l.qty, pack: l.pack })),
          total_rupees: last.total,
        }
      : null,
    credit: shop.credit_due > 0
      ? { due_rupees: shop.credit_due, days_overdue: overdueDays, ask_for_payment_date: (overdueDays ?? 0) >= 7 }
      : null,
    offers: skus
      .filter((s) => s.scheme_note && s.in_stock)
      .map((s) => ({ code: s.code, name: s.name, offer: s.scheme_note })),
    out_of_stock: skus
      .filter((s) => !s.in_stock)
      .map((s) => ({ code: s.code, name: s.name, offer_instead: s.substitute })),
    catalog: skus
      .filter((s) => s.in_stock)
      .map((s) => ({ code: s.code, name: s.name, pack: s.pack, price_rupees: s.price })),
    delivery: "Tomorrow before 11 AM, cash or UPI on delivery",
  });
}

export const GET = handle;
export const POST = handle;
