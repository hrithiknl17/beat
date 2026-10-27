import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { bad, body, signedOut } from "@/lib/http";
import { readProduct } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Add a product to the catalog the agent sells from. */
export async function POST(req: NextRequest) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const parsed = readProduct(await body(req), false);
  if ("error" in parsed) return bad(parsed.error);
  const f = parsed.fields;

  try {
    const product = await one(
      `insert into products (distributor_id, code, name, pack, price, scheme_min_qty, scheme_off, scheme_note, is_new, in_stock, substitute)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [me.id, f.code, f.name, f.pack, f.price, f.scheme_min_qty ?? null, f.scheme_off ?? null, f.scheme_note ?? null, f.is_new ?? false, f.in_stock ?? true, f.substitute ?? null],
    );
    return NextResponse.json({ product });
  } catch {
    return bad(`Code ${f.code} is already in your catalog.`, 409);
  }
}
