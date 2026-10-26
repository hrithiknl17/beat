import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/db";
import { authorized, clean, denied, params, rupees } from "@/lib/http";
import { shopForCall } from "@/lib/agent";
import { setOutcome } from "@/lib/shops";

export const dynamic = "force-dynamic";

function istToday() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

function parseDate(v: string | null): string | null {
  if (!v) return null;
  const s = v.toLowerCase().trim();
  const today = new Date(`${istToday()}T00:00:00Z`);
  const addDays = (n: number) => new Date(today.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  if (["today", "aaj", "ivattu", "indu"].includes(s)) return addDays(0);
  if (["tomorrow", "kal", "naale", "nale"].includes(s)) return addDays(1);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Tool: log_payment_promise. Only for shops with an overdue balance. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return denied();
  const p = await params(req);
  const amount = Math.round(Number(clean(p.amount)?.replace(/[^\d.]/g, "")));
  const date = parseDate(clean(p.promise_date));

  if (!amount || amount <= 0) return NextResponse.json({ status: "need_amount", say: "Ask how much they will pay." });
  if (!date) return NextResponse.json({ status: "need_date", say: "Ask on which date they will pay. Pass it as YYYY-MM-DD." });

  const today = istToday();
  if (date < today) return NextResponse.json({ status: "date_in_past", say: `That date is before today (${today}). Confirm the date again.` });
  const maxDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  if (date > maxDate) {
    return NextResponse.json({ status: "too_far", say: "Promises more than 30 days out need the owner's approval. Ask politely for an earlier date, or say the distributor will call back." });
  }

  const { shop, executionId } = await shopForCall(p);
  // Never log more than what is actually owed.
  const capped = shop.credit_due > 0 ? Math.min(amount, shop.credit_due) : amount;
  await q("delete from payment_promises where execution_id = $1", [executionId]);
  await q(
    "insert into payment_promises (shop_id, execution_id, amount, promise_date) values ($1, $2, $3, $4)",
    [shop.id, executionId, capped, date],
  );
  await setOutcome(executionId, "promised");

  const remaining = Math.max(0, shop.credit_due - capped);
  return NextResponse.json({
    status: "logged",
    amount_rupees: capped,
    promise_date: date,
    balance_after_payment_rupees: remaining,
    say: `Noted ${rupees(capped)} on ${date}.` + (remaining ? ` ${rupees(remaining)} will still be pending after that.` : " That clears the balance."),
  });
}
