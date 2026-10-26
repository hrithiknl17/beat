import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { adminOk, needPin, phone10 } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Set the real number a shop should be called on (your own phone, for the demo). Body: { phone } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!adminOk(req)) return needPin();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const phone = phone10(body.phone);
  if (!phone) return NextResponse.json({ error: "Enter a 10-digit mobile number." }, { status: 400 });

  try {
    const shop = await one("update shops set phone = $2 where id = $1 returning id, name, phone", [Number(id), phone]);
    if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    return NextResponse.json({ shop });
  } catch {
    return NextResponse.json({ error: "Another shop already uses that number." }, { status: 409 });
  }
}
