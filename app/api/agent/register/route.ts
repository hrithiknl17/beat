import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { authorized, clean, denied, params } from "@/lib/http";
import { shopForCall } from "@/lib/agent";
import { toLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

/** Tool: register_shop. Saves the details of a shop that rang in from a number we didn't know. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return denied();
  const p = await params(req);
  const name = clean(p.shop_name);
  if (!name) return NextResponse.json({ status: "need_name", say: "Ask the name of the shop." });

  const { shop } = await shopForCall(p);
  if (shop.status !== "new") {
    return NextResponse.json({ status: "already_known", say: `This shop is already on our list as ${shop.name}. Carry on with the order.` });
  }
  await one(
    `update shops set name = $2, owner_name = coalesce($3, owner_name), area = coalesce($4, area), language = coalesce($5, language)
      where id = $1`,
    [shop.id, name.slice(0, 80), clean(p.owner_name)?.slice(0, 60) ?? null, clean(p.area)?.slice(0, 60) ?? null, toLang(p.language)],
  );
  return NextResponse.json({ status: "registered", say: `Saved ${name}. Welcome them, then take their order.` });
}
