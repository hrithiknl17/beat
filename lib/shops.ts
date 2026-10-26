import { one, q } from "./db";

export type Shop = {
  id: number;
  name: string;
  owner_name: string;
  phone: string | null;
  area: string;
  language: string;
  credit_due: number;
  credit_due_since: string | null;
  is_demo_caller: boolean;
};

export type Sku = {
  code: string;
  name: string;
  pack: string;
  price: number;
  scheme_min_qty: number | null;
  scheme_off: number | null;
  scheme_note: string | null;
  is_new: boolean;
  in_stock: boolean;
  substitute: string | null;
};

/** The profile every unknown caller gets, so anyone can ring the demo number and play the shopkeeper. */
const DEMO_TEMPLATE_SHOP_ID = 1;

/**
 * Finds the shop behind a call. Unknown numbers (judges trying the demo) get their own copy of
 * Sri Lakshmi Stores with last week's order and an overdue balance, so every call shows the full flow.
 */
export async function resolveShop(phone: string | null): Promise<Shop> {
  if (phone) {
    const found = await one<Shop>("select * from shops where phone = $1", [phone]);
    if (found) return found;
  } else {
    const template = await one<Shop>("select * from shops where id = $1", [DEMO_TEMPLATE_SHOP_ID]);
    if (template) return template;
  }

  const created = await one<Shop>(
    `insert into shops (name, owner_name, phone, area, language, credit_due, credit_due_since, is_demo_caller)
     select name, split_part(owner_name, ' ', 1), $1, area, language, credit_due, credit_due_since, true
       from shops where id = $2
     on conflict (phone) do update set phone = excluded.phone
     returning *`,
    [phone, DEMO_TEMPLATE_SHOP_ID],
  );
  if (!created) throw new Error("Demo template shop is missing. Run npm run db:setup.");

  await q(
    `insert into orders (shop_id, lines, subtotal, discount, total, source, created_at)
     select $1, lines, subtotal, discount, total, 'salesman', created_at
       from orders where shop_id = $2 and source = 'salesman'
      order by created_at desc limit 1`,
    [created.id, DEMO_TEMPLATE_SHOP_ID],
  );
  return created;
}

/** Records (or refreshes) the call row so the dashboard shows the call while it is happening. */
export async function touchCall(executionId: string | null, shopId: number, direction: string | null) {
  if (!executionId) return;
  await q(
    `insert into calls (execution_id, shop_id, direction, status)
     values ($1, $2, $3, 'in-progress')
     on conflict (execution_id) do update
       set shop_id = excluded.shop_id,
           direction = coalesce(calls.direction, excluded.direction)`,
    [executionId, shopId, direction],
  );
}

export async function setOutcome(executionId: string | null, outcome: string) {
  if (!executionId) return;
  // An order outranks a promise, which outranks a callback.
  await q(
    `update calls set outcome = $2
      where execution_id = $1
        and coalesce(array_position(array['ordered','promised','callback','no_order'], outcome), 99)
            >= array_position(array['ordered','promised','callback','no_order'], $2)`,
    [executionId, outcome],
  );
}

export function daysSince(date: string | Date | null) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date.length === 10 ? `${date}T00:00:00+05:30` : date) : date;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}
