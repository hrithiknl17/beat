import { q } from "./db";

export type Shop = {
  id: number;
  distributor_id: number;
  name: string;
  owner_name: string;
  phone: string | null;
  area: string;
  language: string;
  credit_due: number;
  credit_due_since: string | null;
  status: string; // active | new | paused
};

export type Sku = {
  id: number;
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

/** Records (or refreshes) the call row so the dashboard shows the call while it is happening. */
export async function touchCall(executionId: string | null, shop: Shop, direction: string | null) {
  if (!executionId) return;
  await q(
    `insert into calls (execution_id, distributor_id, shop_id, direction, status)
     values ($1, $2, $3, $4, 'in-progress')
     on conflict (execution_id) do update
       set shop_id = excluded.shop_id,
           distributor_id = excluded.distributor_id,
           direction = coalesce(calls.direction, excluded.direction)`,
    [executionId, shop.distributor_id, shop.id, direction],
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
