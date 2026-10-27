// Plays one full call against the API exactly the way Bolna's tool calls would, so you can test without a phone.
// Usage: BASE_URL=https://your-app.vercel.app AGENT_TOKEN=... npm run test:agent
//   CALLER       the shop's number. A number your account doesn't know yet rings in as a new shop and gets registered.
//   BEAT_NUMBER  the Beat number set in Settings, so the call lands in that account (else the first account).
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.AGENT_TOKEN ?? "";
const caller = process.env.CALLER ?? `+9198${String(Date.now()).slice(-8)}`;
const beatNumber = process.env.BEAT_NUMBER ?? "+918035739222";
const executionId = `sim-${Date.now()}`;
const ids = { from_number: caller, to_number: beatNumber, execution_id: executionId };

async function tool(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...ids, ...body }),
  });
  const json = await res.json().catch(() => ({ error: `non-JSON response (${res.status})` }));
  console.log(`\n${path} -> ${res.status}`);
  console.log(JSON.stringify(json, null, 2).slice(0, 1200));
  if (!res.ok) process.exit(1);
  return json;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const tomorrow = new Date(Date.now() + 5.5 * 3600e3 + 86400e3).toISOString().slice(0, 10);

let ctx = await tool("/api/agent/shop", {});
if (ctx.new_shop) {
  console.log("\nUnknown number: the agent asks for the shop's details and registers it.");
  await tool("/api/agent/register", { shop_name: "Test Kirana", owner_name: "Manjunath", area: "Jayanagar", language: "kn" });
  ctx = await tool("/api/agent/shop", {});
} else {
  console.log(`\nAgent greets ${ctx.owner_name} of ${ctx.shop_name} and reads back last week's order.`);
}
if (!ctx.catalog?.length) {
  console.log("\nThis account has no products yet. Load the starter catalog on the dashboard, then run this again.");
  process.exit(1);
}
await pause(1200);

// First attempt includes an out-of-stock item (GWO in the starter catalog); the agent should offer the substitute.
await tool("/api/agent/order", { items: "PG100:12, MG70:3, Kurkure Puffcorn 5 box, GWO:2" });
await pause(1200);

// Shopkeeper accepts the substitute; the agent re-places the full list, which replaces the order for this call.
await tool("/api/agent/order", { items: "PG100:12, MG70:3, KPC:5, FSO:2" });
await pause(1200);

if (ctx.credit?.ask_for_payment_date) await tool("/api/agent/payment", { amount: String(ctx.credit.due_rupees), promise_date: tomorrow });

await tool(`/api/webhooks/bolna${token ? `?token=${encodeURIComponent(token)}` : ""}`, {
  id: executionId,
  status: "completed",
  conversation_duration: 94,
  transcript:
    "assistant: Namaskara, ee vaarada order thagolakke call maadidini. Kalada vaara Parle-G, Maggi thagondidri. Ee vaara enu beku?\n" +
    "user: Parle-G 12 box kodi, Maggi 3 case, aamele aa hosa Kurkure Puffcorn 5 box. Gold Winner oil 2 carton.\n" +
    "assistant: Gold Winner ee vaara stock illa, Fortune Sunflower kodla? Maggi 3 case ge 40 rupayi off ide.\n" +
    "user: Sari, Fortune 2 carton kodi.\n" +
    "assistant: 12 box Parle-G, 3 case Maggi, 5 box Kurkure Puffcorn, 2 carton Fortune. Total 13,280 rupayi. Naale 11 gante olage delivery. Dhanyavaadagalu!",
  telephony_data: { from_number: caller, to_number: beatNumber, call_type: "inbound" },
});

console.log(`\nDone. Open ${base}/app to see the order slip and the call.`);
