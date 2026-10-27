import { one } from "./db";
import { clean, phone10 } from "./http";
import { touchCall, type Shop } from "./shops";

/** The account that takes calls to a number nobody has claimed in Settings (INBOUND_DISTRIBUTOR_ID, else the first account). */
async function defaultDistributorId(): Promise<number> {
  const fromEnv = Number(process.env.INBOUND_DISTRIBUTOR_ID);
  if (fromEnv) return fromEnv;
  const first = await one<{ id: number }>("select id from distributors order by id limit 1");
  if (!first) throw new Error("No distributor account exists yet. Sign up on the dashboard first.");
  return first.id;
}

/** A caller we don't know yet becomes a "new" shop; the agent asks their details and calls register_shop. */
async function newShop(distributorId: number, phone: string | null): Promise<Shop> {
  const shop = await one<Shop>(
    `insert into shops (distributor_id, name, phone, status) values ($1, 'New shop', $2, 'new')
     on conflict (distributor_id, phone) do update set phone = excluded.phone
     returning *`,
    [distributorId, phone],
  );
  return shop!;
}

/**
 * Every tool call carries from_number, to_number and execution_id (filled from Bolna's
 * {{from_number}}, {{to_number}}, {{execution_id}} context variables).
 * Outbound: we placed the call, so the execution is already tied to a shop.
 * Inbound: to_number is a distributor's Beat number and from_number is the shop.
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

  let shop: Shop | null = null;
  let direction: string | null = null;

  if (explicit) shop = await one<Shop>("select * from shops where phone = $1 order by id limit 1", [explicit]);

  if (!shop && to) {
    const account = await one<{ id: number }>("select id from distributors where phone_number = $1", [to]);
    if (account) {
      direction = "inbound";
      shop = (from && (await one<Shop>("select * from shops where distributor_id = $1 and phone = $2", [account.id, from])))
        || (await newShop(account.id, from));
    }
  }
  if (!shop && to) {
    shop = await one<Shop>("select * from shops where phone = $1 order by id limit 1", [to]);
    if (shop) direction = "outbound";
  }
  if (!shop && from) {
    shop = await one<Shop>("select * from shops where phone = $1 order by id limit 1", [from]);
    if (shop) direction = "inbound";
  }
  if (!shop) {
    shop = await newShop(await defaultDistributorId(), from);
    direction = from ? "inbound" : null;
  }

  await touchCall(executionId, shop, direction);
  return { shop, executionId };
}
