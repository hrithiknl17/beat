import { NextResponse } from "next/server";
import { one, q } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { isPlaceholder, signedOut } from "@/lib/http";
import { agentLanguages, canCall } from "@/lib/bolna";

export const dynamic = "force-dynamic";

// Midnight today in India, as a timestamptz.
const IST_TODAY = "(date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')";

/** Everything the signed-in distributor's dashboard shows, in one read. Polled every few seconds. */
export async function GET() {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = [me.id];

  const [shops, orders, calls, promises, callbacks, payments, products, stats] = await Promise.all([
    q(`select s.*,
              lo.total as last_total, lo.created_at as last_order_at, lo.source as last_source,
              lc.status as call_status, lc.outcome as call_outcome, lc.started_at as call_at,
              lp.amount as promise_amount, lp.promise_date
         from shops s
         left join lateral (select total, created_at, source from orders o where o.shop_id = s.id and o.status <> 'cancelled' order by created_at desc limit 1) lo on true
         left join lateral (select status, outcome, started_at from calls c where c.shop_id = s.id and c.started_at > ${IST_TODAY} order by started_at desc limit 1) lc on true
         left join lateral (select amount, promise_date from payment_promises p where p.shop_id = s.id and p.status = 'open' order by created_at desc limit 1) lp on true
        where s.distributor_id = $1
        order by (s.status = 'new') desc, s.status = 'paused', s.id`, id),
    q(`select o.id, o.shop_id, s.name as shop_name, s.area, s.phone, o.lines, o.subtotal, o.discount, o.total,
              o.source, o.status, o.paid_by, o.delivered_at, o.created_at, o.execution_id
         from orders o join shops s on s.id = o.shop_id
        where o.distributor_id = $1
        order by o.created_at desc limit 200`, id),
    q(`select c.execution_id, c.shop_id, s.name as shop_name, s.phone, s.status as shop_status, c.direction, c.purpose, c.status, c.outcome,
              c.started_at, c.ended_at, c.duration_sec, c.transcript, c.recording_url
         from calls c left join shops s on s.id = c.shop_id
        where c.distributor_id = $1
        order by c.started_at desc limit 100`, id),
    q(`select p.id, p.shop_id, s.name as shop_name, p.amount, p.promise_date, p.status, p.created_at
         from payment_promises p join shops s on s.id = p.shop_id
        where p.distributor_id = $1
        order by p.status = 'open' desc, p.promise_date, p.created_at desc limit 100`, id),
    q(`select b.id, b.shop_id, s.name as shop_name, b.callback_at, b.note, b.status, b.created_at
         from callbacks b join shops s on s.id = b.shop_id
        where b.distributor_id = $1
        order by b.status = 'pending' desc, b.callback_at nulls last, b.created_at desc limit 50`, id),
    q(`select y.id, y.shop_id, s.name as shop_name, y.amount, y.method, y.note, y.received_at
         from payments y join shops s on s.id = y.shop_id
        where y.distributor_id = $1
        order by y.received_at desc limit 100`, id),
    q(`select * from products where distributor_id = $1 order by name`, id),
    one<Record<string, number>>(
      `select
         (select count(*) from orders where distributor_id = $1 and source = 'call' and status <> 'cancelled' and created_at > ${IST_TODAY})::int as orders,
         (select coalesce(sum(total), 0) from orders where distributor_id = $1 and source = 'call' and status <> 'cancelled' and created_at > ${IST_TODAY})::int as booked,
         (select coalesce(sum(amount), 0) from payment_promises where distributor_id = $1 and created_at > ${IST_TODAY})::int as promised,
         (select count(*) from calls where distributor_id = $1 and started_at > ${IST_TODAY})::int as calls,
         (select count(distinct shop_id) from calls where distributor_id = $1 and started_at > ${IST_TODAY})::int as shops_called,
         (select count(*) from shops where distributor_id = $1 and status = 'active')::int as active_shops,
         (select coalesce(sum(credit_due), 0) from shops where distributor_id = $1)::int as outstanding,
         (select coalesce(sum(amount), 0) from payments where distributor_id = $1 and received_at > ${IST_TODAY})::int as collected,
         (select count(*) from orders where distributor_id = $1 and status in ('new', 'packed', 'dispatched'))::int as open_orders`,
      id,
    ),
  ]);

  return NextResponse.json({
    me,
    can_call: canCall(),
    agent_languages: agentLanguages(),
    stats,
    shops: shops.map((s) => ({ ...s, dialable: !isPlaceholder(s.phone) })),
    orders,
    calls,
    promises,
    callbacks,
    payments,
    products,
  });
}
