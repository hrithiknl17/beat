import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/db";
import { currentDistributor } from "@/lib/auth";
import { body, signedOut } from "@/lib/http";
import { placeCall, type CallResult } from "@/lib/bolna";
import type { Shop } from "@/lib/shops";

export const dynamic = "force-dynamic";

/** "Start beat": places an outbound Bolna call to each shop, in the shop's language. Body: { shop_ids?: number[] } */
export async function POST(req: NextRequest) {
  const me = await currentDistributor();
  if (!me) return signedOut();
  const { shop_ids } = await body<{ shop_ids: number[] }>(req);
  const ids = Array.isArray(shop_ids) ? shop_ids.map(Number).filter(Boolean) : [];

  const shops = ids.length
    ? await q<Shop>("select * from shops where distributor_id = $1 and id = any($2::int[]) order by id", [me.id, ids])
    : await q<Shop>("select * from shops where distributor_id = $1 and status = 'active' order by id", [me.id]);

  const results: CallResult[] = [];
  for (const shop of shops) results.push(await placeCall(shop, me.name));
  return NextResponse.json({ results });
}
