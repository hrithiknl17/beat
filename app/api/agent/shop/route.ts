import { NextResponse, type NextRequest } from "next/server";
import { q, one } from "@/lib/db";
import { authorized, denied, params } from "@/lib/http";
import { shopForCall } from "@/lib/agent";
import { langName } from "@/lib/lang";
import { daysSince, type Sku } from "@/lib/shops";
import type { Line } from "@/lib/orders";

export const dynamic = "force-dynamic";

/** Tool: get_shop_context. Called at the start of every call. */
async function handle(req: NextRequest) {
  if (!authorized(req)) return denied();
  const p = await params(req);
  const { shop } = await shopForCall(p);

  const [account, last, skus] = await Promise.all([
    one<{ name: string; delivery_note: string }>("select name, delivery_note from distributors where id = $1", [shop.distributor_id]),
    one<{ lines: Line[]; total: number; created_at: string }>(
      "select lines, total, created_at from orders where shop_id = $1 and status <> 'cancelled' order by created_at desc limit 1",
      [shop.id],
    ),
    q<Sku>("select * from products where distributor_id = $1 order by name", [shop.distributor_id]),
  ]);
  const overdueDays = daysSince(shop.credit_due_since);
  const isNew = shop.status === "new";

  return NextResponse.json({
    distributor: account?.name ?? "",
    new_shop: isNew,
    ...(isNew
      ? { instructions: "This number is not on our list yet. Politely ask the shop name, the owner's name and the area, then call register_shop. After that, take their order as usual." }
      : {}),
    shop_name: isNew ? null : shop.name,
    owner_name: shop.owner_name || null,
    area: shop.area || null,
    preferred_language: langName(shop.language),
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
    ...(skus.length ? {} : { note: "The product list is empty. Note what they want and say the distributor will call back to confirm." }),
    delivery: account?.delivery_note ?? "",
  });
}

export const GET = handle;
export const POST = handle;
