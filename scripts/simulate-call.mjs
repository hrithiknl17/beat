// Plays one full call against the API exactly the way Bolna's tool calls would,
// so you can test the dashboard without a phone.
// Usage: BASE_URL=https://your-app.vercel.app AGENT_TOKEN=... npm run test:agent
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.AGENT_TOKEN ?? "";
const caller = process.env.CALLER ?? "+919845012345"; // an unknown number becomes a demo shop
const agentNumber = "+918035739222";
const executionId = `sim-${Date.now()}`;
const ids = { from_number: caller, to_number: agentNumber, execution_id: executionId };

async function tool(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...ids, ...body }),
  });
  const json = await res.json();
  console.log(`\n${path} -> ${res.status}`);
  console.log(JSON.stringify(json, null, 2).slice(0, 1400));
  if (!res.ok) process.exit(1);
  return json;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const tomorrow = new Date(Date.now() + 5.5 * 3600e3 + 86400e3).toISOString().slice(0, 10);

const ctx = await tool("/api/agent/shop", {});
console.log(`\nAgent greets ${ctx.owner_name} of ${ctx.shop_name} and reads back last week's order.`);
await pause(1500);

// First attempt includes an out-of-stock item; the agent should offer the substitute.
await tool("/api/agent/order", { items: "PG100:12, MG70:3, Kurkure Puffcorn 5 box, GWO:2" });
await pause(1500);

// Shopkeeper accepts Fortune instead; agent re-places the full list (replaces the order for this call).
await tool("/api/agent/order", { items: "PG100:12, MG70:3, KPC:5, FSO:2" });
await pause(1500);

if (ctx.credit) await tool("/api/agent/payment", { amount: String(ctx.credit.due_rupees), promise_date: tomorrow });

await tool(`/api/webhooks/bolna${token ? `?token=${encodeURIComponent(token)}` : ""}`, {
  id: executionId,
  status: "completed",
  conversation_duration: 94,
  transcript:
    "assistant: Namaskara Ramesh avare, Sri Ganesh Distributors inda maathadtha iddini. Kalada vaara 10 box Parle-G, 2 case Maggi, 2 bag Tata Salt thagondidri. Ee vaara enu beku?\n" +
    "user: Parle-G 12 box kodi, Maggi 3 case, aamele aa hosa Kurkure Puffcorn 5 box. Gold Winner oil 2 carton.\n" +
    "assistant: Gold Winner ee vaara stock illa, Fortune Sunflower kodla? Maggi 3 case ge 40 rupayi off ide.\n" +
    "user: Sari, Fortune 2 carton kodi.\n" +
    "assistant: 12 box Parle-G, 3 case Maggi, 5 box Kurkure Puffcorn, 2 carton Fortune. Total 13,280 rupayi. Naale 11 gante olage delivery. Innondu vishya, 4,800 baaki ide, yaavaga kodtira?\n" +
    "user: Naale delivery jothe kodthini.\n" +
    "assistant: Sari, naale 4,800. Dhanyavaadagalu!",
  telephony_data: { from_number: caller, to_number: agentNumber, call_type: "inbound" },
});

console.log(`\nDone. Open ${base} to see the order slip, call and payment promise.`);
