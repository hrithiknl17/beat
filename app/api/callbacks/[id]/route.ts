import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { bad, body, signedOut } from "@/lib/http";
import { placeCall } from "@/lib/bolna";
import type { Shop } from "@/lib/shops";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Close a callback by hand. Body: { status: "done" | "cancelled" } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = Number((await ctx.params).id);
  const { status } = await body<{ status: string }>(req);
  if (status !== "done" && status !== "cancelled") return bad("Unknown callback status.");
  const row = await one("update callbacks set status = $3 where id = $1 and distributor_id = $2 returning id", [id, me.id, status]);
  if (!row) return bad("Callback not found.", 404);
  return NextResponse.json({ ok: true });
}

/** Call the shop back now instead of waiting for the scheduled time. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = Number((await ctx.params).id);
  const shop = await one<Shop & { callback_id: number }>(
    `select s.*, b.id as callback_id from callbacks b join shops s on s.id = b.shop_id
      where b.id = $1 and b.distributor_id = $2 and b.status = 'pending'`,
    [id, me.id],
  );
  if (!shop) return bad("This callback is no longer pending.", 404);

  const result = await placeCall(shop, me.name, "callback");
  if (!result.ok) return bad(`Couldn't call ${shop.name}: ${result.reason}.`);
  await one("update callbacks set status = 'dialled', dialled_execution_id = $2 where id = $1", [id, result.execution_id]);
  return NextResponse.json({ ok: true, execution_id: result.execution_id });
}
