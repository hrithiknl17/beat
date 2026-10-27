import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/db";
import { canCall, placeCall } from "@/lib/bolna";
import type { Shop } from "@/lib/shops";

export const dynamic = "force-dynamic";

/**
 * Dials every callback whose time has come. Vercel Cron calls this with "Authorization: Bearer CRON_SECRET";
 * any other scheduler can call /api/cron/dispatch?secret=CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const ok = secret && (req.headers.get("authorization") === `Bearer ${secret}` || req.nextUrl.searchParams.get("secret") === secret);
  if (!ok) return NextResponse.json({ error: "bad secret" }, { status: 401 });
  // Without Bolna keys nothing can dial; leave callbacks pending rather than closing them.
  if (!canCall()) return NextResponse.json({ dialled: 0, skipped: "outbound calling is not configured" });

  const due = await q<Shop & { callback_id: number; distributor_name: string }>(
    `select s.*, b.id as callback_id, d.name as distributor_name
       from callbacks b join shops s on s.id = b.shop_id join distributors d on d.id = b.distributor_id
      where b.status = 'pending' and b.callback_at is not null and b.callback_at <= now()
      order by b.callback_at limit 20`,
  );

  const results = [];
  for (const row of due) {
    const r = await placeCall(row, row.distributor_name, "callback");
    // A failed dial is closed rather than retried every minute; it stays visible on the dashboard.
    await q("update callbacks set status = $2, dialled_execution_id = $3 where id = $1",
      [row.callback_id, r.ok ? "dialled" : "cancelled", r.ok ? r.execution_id : null]);
    results.push(r);
  }
  return NextResponse.json({ dialled: results.filter((r) => r.ok).length, results });
}
