import { NextResponse, type NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { bad, body, signedOut } from "@/lib/http";

export const dynamic = "force-dynamic";

const FLOW = ["new", "packed", "dispatched", "delivered"];

/**
 * Move an order along: new -> packed -> dispatched -> delivered, or cancel it before delivery.
 * Body: { status, paid_by? } — delivering needs paid_by: cash (collected) or credit (added to the shop's balance).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = Number((await ctx.params).id);
  const { status, paid_by } = await body<{ status: string; paid_by: string }>(req);
  if (!status || (!FLOW.includes(status) && status !== "cancelled")) return bad("Unknown order status.");
  if (status === "delivered" && paid_by !== "cash" && paid_by !== "credit") return bad("Say whether the shop paid cash or took it on credit.");

  const client = await pool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ status: string; total: number; shop_id: number }>(
      "select status, total, shop_id from orders where id = $1 and distributor_id = $2 for update",
      [id, me.id],
    );
    const order = rows[0];
    if (!order) { await client.query("rollback"); return bad("Order not found.", 404); }
    if (order.status === "delivered" || order.status === "cancelled") {
      await client.query("rollback");
      return bad(`This order is already ${order.status}.`, 409);
    }
    if (status !== "cancelled" && FLOW.indexOf(status) <= FLOW.indexOf(order.status)) {
      await client.query("rollback");
      return bad(`This order is already ${order.status}.`, 409);
    }

    await client.query(
      `update orders set status = $2,
              paid_by = case when $2 = 'delivered' then $3 else paid_by end,
              delivered_at = case when $2 = 'delivered' then now() else delivered_at end
        where id = $1`,
      [id, status, paid_by ?? null],
    );
    if (status === "delivered" && paid_by === "credit") {
      await client.query(
        "update shops set credit_due = credit_due + $2, credit_due_since = coalesce(credit_due_since, (now() at time zone 'Asia/Kolkata')::date) where id = $1",
        [order.shop_id, order.total],
      );
    }
    await client.query("commit");
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
