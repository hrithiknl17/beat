import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { bad, body, signedOut } from "@/lib/http";
import { readShop } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Add a shop to the beat. */
export async function POST(req: NextRequest) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const parsed = readShop(await body(req), false);
  if ("error" in parsed) return bad(parsed.error);
  const f = parsed.fields;

  try {
    const shop = await one(
      `insert into shops (distributor_id, name, owner_name, phone, area, language, credit_due, credit_due_since, notes)
       values ($1, $2, $3, $4, $5, $6, $7, case when $7 > 0 then (now() at time zone 'Asia/Kolkata')::date end, $8)
       returning *`,
      [me.id, f.name, f.owner_name ?? "", f.phone ?? null, f.area ?? "", f.language ?? "kn", f.credit_due ?? 0, f.notes ?? null],
    );
    return NextResponse.json({ shop });
  } catch {
    return bad("Another shop already uses that number.", 409);
  }
}
