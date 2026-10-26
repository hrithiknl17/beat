import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { isPlaceholder } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Everything the dashboard shows, in one read. Polled every 2 seconds. */
export async function GET() {
  const [shops, orders, calls, promises, callbacks] = await Promise.all([
    q(`select s.id, s.name, s.owner_name, s.phone, s.area, s.language, s.credit_due, s.credit_due_since, s.is_demo_caller,
              lo.total as last_total, lo.created_at as last_order_at, lo.source as last_source,
              lc.status as call_status, lc.outcome as call_outcome, lc.started_at as call_at,
              lp.amount as promise_amount, lp.promise_date
         from shops s
         left join lateral (select total, created_at, source from orders o where o.shop_id = s.id order by created_at desc limit 1) lo on true
         left join lateral (select status, outcome, started_at from calls c where c.shop_id = s.id and c.started_at > now() - interval '1 day' order by started_at desc limit 1) lc on true
         left join lateral (select amount, promise_date from payment_promises p where p.shop_id = s.id and p.promise_date >= current_date order by created_at desc limit 1) lp on true
        order by s.is_demo_caller, s.id`),
    q(`select o.id, o.shop_id, s.name as shop_name, s.area, s.is_demo_caller, s.phone, o.lines, o.subtotal, o.discount, o.total, o.created_at, o.execution_id
         from orders o join shops s on s.id = o.shop_id
        where o.source = 'call'
        order by o.created_at desc limit 40`),
    q(`select c.execution_id, c.shop_id, s.name as shop_name, s.phone, s.is_demo_caller, c.direction, c.status, c.outcome,
              c.started_at, c.ended_at, c.duration_sec, c.transcript, c.recording_url
         from calls c left join shops s on s.id = c.shop_id
        order by c.started_at desc limit 40`),
    q(`select p.id, p.shop_id, s.name as shop_name, s.phone, s.is_demo_caller, p.amount, p.promise_date, p.created_at
         from payment_promises p join shops s on s.id = p.shop_id
        order by p.created_at desc limit 40`),
    q(`select b.id, b.shop_id, s.name as shop_name, b.callback_at, b.note, b.created_at
         from callbacks b join shops s on s.id = b.shop_id
        order by b.created_at desc limit 20`),
  ]);

  const today = (d: string) => new Date(d).getTime() > Date.now() - 86_400_000;
  const todaysOrders = orders.filter((o) => today(o.created_at));
  return NextResponse.json({
    distributor: process.env.DISTRIBUTOR_NAME ?? "Sri Ganesh Distributors",
    can_call: Boolean(process.env.BOLNA_API_KEY && (process.env.BOLNA_AGENT_ID_KN || process.env.BOLNA_AGENT_ID_HI || process.env.BOLNA_AGENT_ID)),
    pin_required: Boolean(process.env.DASHBOARD_PIN),
    stats: {
      orders: todaysOrders.length,
      booked: todaysOrders.reduce((s, o) => s + o.total, 0),
      promised: promises.filter((p) => today(p.created_at)).reduce((s, p) => s + p.amount, 0),
      calls: calls.filter((c) => today(c.started_at)).length,
    },
    shops: shops.map((s) => ({ ...s, dialable: !isPlaceholder(s.phone) })),
    orders,
    calls,
    promises,
    callbacks,
  });
}
