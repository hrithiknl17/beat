import { one } from "./db";
import { clean, phone10 } from "./http";
import { resolveShop, touchCall, type Shop } from "./shops";

/**
 * Every tool call carries from_number, to_number and execution_id (filled from Bolna's
 * {{from_number}}, {{to_number}}, {{execution_id}} context variables).
 * Outbound: the shop is to_number. Inbound: the shop is from_number.
 * We pick whichever number belongs to a known shop; if neither does, it's a new demo caller.
 */
export async function shopForCall(p: Record<string, unknown>): Promise<{ shop: Shop; executionId: string | null }> {
  const executionId = clean(p.execution_id);
  const from = phone10(p.from_number);
  const to = phone10(p.to_number);
  const explicit = phone10(p.shop_phone);

  // A call we already tied to a shop stays tied to it.
  if (executionId) {
    const tied = await one<Shop>(
      "select s.* from calls c join shops s on s.id = c.shop_id where c.execution_id = $1",
      [executionId],
    );
    if (tied) return { shop: tied, executionId };
  }

  let phone: string | null = explicit;
  let direction: string | null = null;
  if (!phone) {
    for (const [candidate, dir] of [[to, "outbound"], [from, "inbound"]] as const) {
      if (candidate && (await one("select 1 from shops where phone = $1", [candidate]))) {
        phone = candidate;
        direction = dir;
        break;
      }
    }
  }
  if (!phone) { phone = from; direction = from ? "inbound" : null; }

  const shop = await resolveShop(phone);
  await touchCall(executionId, shop.id, direction);
  return { shop, executionId };
}
