import { NextResponse, type NextRequest } from "next/server";
import { q } from "@/lib/db";
import { authorized, clean, denied, params } from "@/lib/http";
import { shopForCall } from "@/lib/agent";
import { setOutcome } from "@/lib/shops";

export const dynamic = "force-dynamic";

/** Tool: schedule_callback. When the shopkeeper is busy ("call after 6"). */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return denied();
  const p = await params(req);
  const when = clean(p.callback_at);
  const note = clean(p.note);
  if (!when) return NextResponse.json({ status: "need_time", say: "Ask what time suits them, then call this again." });

  // Accept ISO ("2026-10-27T18:00") interpreted as IST; anything else is kept as a note.
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(when) ? new Date(`${when.slice(0, 16)}:00+05:30`) : null;
  const { shop, executionId } = await shopForCall(p);
  await q(
    "insert into callbacks (shop_id, execution_id, callback_at, note) values ($1, $2, $3, $4)",
    [shop.id, executionId, iso && !isNaN(iso.getTime()) ? iso.toISOString() : null, note ?? (iso ? null : when)],
  );
  await setOutcome(executionId, "callback");

  return NextResponse.json({ status: "scheduled", say: "Callback noted. Thank them and end the call politely." });
}
