import { q } from "./db";
import { isPlaceholder } from "./http";
import { LANG_CODES } from "./lang";
import type { Shop } from "./shops";

/** The Bolna agent that speaks this language: BOLNA_AGENT_ID_TE for Telugu, and so on. */
export function agentFor(language: string) {
  const env = process.env;
  return env[`BOLNA_AGENT_ID_${language.toUpperCase()}`] || env.BOLNA_AGENT_ID || env.BOLNA_AGENT_ID_KN || null;
}

/** Which languages have an agent set up, for Settings. */
export function agentLanguages() {
  return LANG_CODES.filter((c) => Boolean(process.env[`BOLNA_AGENT_ID_${c.toUpperCase()}`]));
}

export const canCall = () => Boolean(process.env.BOLNA_API_KEY && (process.env.BOLNA_AGENT_ID || agentLanguages().length));

export type CallResult = { shop: string; ok: true; execution_id: string } | { shop: string; ok: false; reason: string };

/** Places one outbound call through Bolna and records it so the dashboard shows it ringing. */
export async function placeCall(shop: Shop, distributorName: string, purpose: "beat" | "callback" = "beat"): Promise<CallResult> {
  const key = process.env.BOLNA_API_KEY;
  if (!key) return { shop: shop.name, ok: false, reason: "calling isn't switched on yet (BOLNA_API_KEY missing)" };
  if (shop.status === "paused") return { shop: shop.name, ok: false, reason: "shop is paused" };
  if (isPlaceholder(shop.phone)) return { shop: shop.name, ok: false, reason: "add a real phone number first" };
  const agentId = agentFor(shop.language);
  if (!agentId) return { shop: shop.name, ok: false, reason: `no Bolna agent for ${shop.language}` };

  const res = await fetch("https://api.bolna.ai/call", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      recipient_phone_number: `+91${shop.phone}`,
      ...(process.env.BOLNA_FROM_NUMBER ? { from_phone_number: process.env.BOLNA_FROM_NUMBER } : {}),
      user_data: { shop_name: shop.name, owner_name: shop.owner_name, distributor: distributorName, timezone: "Asia/Kolkata" },
    }),
  }).catch((e: Error) => ({ ok: false, json: async () => ({ message: e.message }) }) as unknown as Response);

  const data = (await res.json().catch(() => ({}))) as { execution_id?: string; message?: string; detail?: unknown };
  if (!res.ok || !data.execution_id) {
    return { shop: shop.name, ok: false, reason: data.message ?? JSON.stringify(data.detail ?? data).slice(0, 160) };
  }
  await q(
    `insert into calls (execution_id, distributor_id, shop_id, direction, purpose, status)
     values ($1, $2, $3, 'outbound', $4, 'queued')
     on conflict (execution_id) do nothing`,
    [data.execution_id, shop.distributor_id, shop.id, purpose],
  );
  return { shop: shop.name, ok: true, execution_id: data.execution_id };
}
