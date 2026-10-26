import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/db";
import { adminOk, isPlaceholder, needPin } from "@/lib/http";
import type { Shop } from "@/lib/shops";

export const dynamic = "force-dynamic";

function agentFor(language: string) {
  const fallback = process.env.BOLNA_AGENT_ID;
  if (language === "hi") return process.env.BOLNA_AGENT_ID_HI || fallback || process.env.BOLNA_AGENT_ID_KN;
  return process.env.BOLNA_AGENT_ID_KN || fallback || process.env.BOLNA_AGENT_ID_HI;
}

/** "Start beat": places an outbound Bolna call to each shop, in the shop's language. Body: { shop_ids?: number[] } */
export async function POST(req: NextRequest) {
  if (!adminOk(req)) return needPin();
  const key = process.env.BOLNA_API_KEY;
  if (!key) return NextResponse.json({ error: "Add BOLNA_API_KEY and the agent IDs in Vercel settings to place calls." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { shop_ids?: number[] };
  const shops = body.shop_ids?.length
    ? await q<Shop>("select * from shops where id = any($1::int[])", [body.shop_ids])
    : await q<Shop>("select * from shops where not is_demo_caller order by id");

  const results = [];
  for (const shop of shops) {
    if (isPlaceholder(shop.phone)) {
      results.push({ shop: shop.name, ok: false, reason: "add a real phone number for this shop first" });
      continue;
    }
    const agentId = agentFor(shop.language);
    if (!agentId) { results.push({ shop: shop.name, ok: false, reason: "no Bolna agent ID set" }); continue; }

    const res = await fetch("https://api.bolna.ai/call", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: `+91${shop.phone}`,
        ...(process.env.BOLNA_FROM_NUMBER ? { from_phone_number: process.env.BOLNA_FROM_NUMBER } : {}),
        user_data: { shop_name: shop.name, owner_name: shop.owner_name, timezone: "Asia/Kolkata" },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { execution_id?: string; message?: string; detail?: unknown };
    if (!res.ok || !data.execution_id) {
      results.push({ shop: shop.name, ok: false, reason: data.message ?? JSON.stringify(data.detail ?? data).slice(0, 160) });
      continue;
    }
    await q(
      `insert into calls (execution_id, shop_id, direction, status) values ($1, $2, 'outbound', 'queued')
       on conflict (execution_id) do nothing`,
      [data.execution_id, shop.id],
    );
    results.push({ shop: shop.name, ok: true, execution_id: data.execution_id });
  }
  return NextResponse.json({ results });
}
