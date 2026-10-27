import { NextResponse, type NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { bad, body, rupeesIn, signedOut } from "@/lib/http";

export const dynamic = "force-dynamic";

const METHODS = ["cash", "upi", "cheque"];

/** Record money received from a shop. Lowers its balance and marks a matching promise as kept. */
export async function POST(req: NextRequest) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const b = await body<{ shop_id: number; amount: string | number; method: string; note: string }>(req);
  const shopId = Number(b.shop_id);
  const amount = rupeesIn(b.amount);
  const method = METHODS.includes(String(b.method)) ? String(b.method) : "cash";
  if (!shopId) return bad("Pick a shop.");
  if (!amount) return bad("Enter the amount received.");

  const client = await pool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ credit_due: number }>(
      "select credit_due from shops where id = $1 and distributor_id = $2 for update",
      [shopId, me.id],
    );
    if (!rows[0]) { await client.query("rollback"); return bad("Shop not found.", 404); }

    await client.query(
      "insert into payments (distributor_id, shop_id, amount, method, note) values ($1, $2, $3, $4, $5)",
      [me.id, shopId, amount, method, b.note ? String(b.note).slice(0, 200) : null],
    );
    const remaining = Math.max(0, rows[0].credit_due - amount);
    await client.query(
      "update shops set credit_due = $2, credit_due_since = case when $2 = 0 then null else credit_due_since end where id = $1",
      [shopId, remaining],
    );
    // A payment that covers the open promise (or clears the balance) keeps it.
    await client.query(
      `update payment_promises set status = 'kept'
        where shop_id = $1 and status = 'open' and ($2 = 0 or amount <= $3)`,
      [shopId, remaining, amount],
    );
    await client.query("commit");
    return NextResponse.json({ ok: true, remaining });
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
