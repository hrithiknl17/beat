import { NextResponse, type NextRequest } from "next/server";
import { one, updateOwned } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { bad, body, signedOut } from "@/lib/http";
import { readProduct } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Edit a product: price, scheme, stock, substitute. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = Number((await ctx.params).id);
  const parsed = readProduct(await body(req), true);
  if ("error" in parsed) return bad(parsed.error);

  try {
    const product = await updateOwned("products", id, me.id, parsed.fields);
    if (!product) return bad("Product not found.", 404);
    return NextResponse.json({ product });
  } catch {
    return bad("Another product already uses that code.", 409);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const id = Number((await ctx.params).id);
  const gone = await one("delete from products where id = $1 and distributor_id = $2 returning id", [id, me.id]);
  if (!gone) return bad("Product not found.", 404);
  return NextResponse.json({ ok: true });
}
