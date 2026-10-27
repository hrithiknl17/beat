import { NextResponse, type NextRequest } from "next/server";
import { one, updateOwned } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { bad, body, istToday, signedOut } from "@/lib/http";
import { readShop } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a shop: details, number, language, credit, or status (active | paused). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = Number((await ctx.params).id);
  const parsed = readShop(await body(req), true);
  if ("error" in parsed) return bad(parsed.error);
  const fields: Record<string, unknown> = { ...parsed.fields };

  // Changing the balance by hand restarts the overdue clock only when it goes from clear to owing.
  if (typeof fields.credit_due === "number") {
    const current = await one<{ credit_due: number; credit_due_since: string | null }>(
      "select credit_due, credit_due_since from shops where id = $1 and distributor_id = $2", [id, me.id]);
    if (!current) return bad("Shop not found.", 404);
    if (fields.credit_due === 0) fields.credit_due_since = null;
    else if (!current.credit_due_since) fields.credit_due_since = istToday();
  }

  try {
    const shop = await updateOwned("shops", id, me.id, fields);
    if (!shop) return bad("Shop not found.", 404);
    return NextResponse.json({ shop });
  } catch {
    return bad("Another shop already uses that number.", 409);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = Number((await ctx.params).id);
  const gone = await one("delete from shops where id = $1 and distributor_id = $2 returning id", [id, me.id]);
  if (!gone) return bad("Shop not found.", 404);
  return NextResponse.json({ ok: true });
}
