import { NextResponse, type NextRequest } from "next/server";
import { one, q } from "@/lib/db";
import { authorized, phone10 } from "@/lib/http";

export const dynamic = "force-dynamic";

type Payload = {
  id?: string;
  execution_id?: string;
  status?: string;
  transcript?: string;
  conversation_duration?: number;
  conversation_time?: number;
  telephony_data?: {
    to_number?: string;
    from_number?: string;
    recording_url?: string;
    call_type?: string;
    duration?: number | string;
  };
};

const DONE = new Set(["completed", "call-disconnected", "no-answer", "busy", "failed", "canceled", "cancelled", "stopped", "error", "balance-low"]);

/**
 * Bolna posts the execution here as the call moves through its statuses, and the full
 * transcript once it completes. Set the agent's webhook URL to /api/webhooks/bolna?token=AGENT_TOKEN
 */
export async function POST(req: NextRequest) {
  const tokenOk = authorized(req) || (process.env.AGENT_TOKEN && req.nextUrl.searchParams.get("token") === process.env.AGENT_TOKEN);
  if (!tokenOk) return NextResponse.json({ error: "bad token" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Payload;
  const executionId = body.id ?? body.execution_id;
  if (!executionId) return NextResponse.json({ ok: true, ignored: "no execution id" });

  const t = body.telephony_data ?? {};
  const direction = t.call_type ?? null;
  const shopPhone = direction === "inbound" ? phone10(t.from_number) : phone10(t.to_number);
  const shop = shopPhone ? await one<{ id: number }>("select id from shops where phone = $1", [shopPhone]) : null;
  const status = (body.status ?? "in-progress").toLowerCase();
  const finished = DONE.has(status);
  const duration = Number(body.conversation_duration ?? body.conversation_time ?? t.duration) || null;

  await q(
    `insert into calls (execution_id, shop_id, direction, status, transcript, recording_url, duration_sec, ended_at)
     values ($1, $2, $3, $4, $5, $6, $7, case when $8 then now() end)
     on conflict (execution_id) do update set
       shop_id       = coalesce(calls.shop_id, excluded.shop_id),
       direction     = coalesce(excluded.direction, calls.direction),
       status        = excluded.status,
       transcript    = coalesce(excluded.transcript, calls.transcript),
       recording_url = coalesce(excluded.recording_url, calls.recording_url),
       duration_sec  = coalesce(excluded.duration_sec, calls.duration_sec),
       ended_at      = coalesce(calls.ended_at, excluded.ended_at)`,
    [executionId, shop?.id ?? null, direction, status, body.transcript ?? null, t.recording_url ?? null, duration ? Math.round(duration) : null, finished],
  );
  if (finished) {
    await q("update calls set outcome = coalesce(outcome, 'no_order') where execution_id = $1 and status = 'completed'", [executionId]);
  }
  return NextResponse.json({ ok: true });
}
