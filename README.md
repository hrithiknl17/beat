# Beat

A voice agent that does an FMCG salesman's weekly beat over the phone.

Distributors in India send salesmen to visit kirana shops on a fixed route (a "beat") to take restock orders. Beat calls each shop instead, in Kannada or Hindi, built on [Bolna](https://bolna.ai). It:

- greets the owner by name and reads back last week's order
- takes this week's order and prices it against the distributor's catalog
- applies trade schemes, and offers a substitute when something is out of stock
- asks for a payment date when the shop has overdue credit
- books a callback when the shopkeeper is busy

Every order prints onto a live dashboard while the call is still going.

**Try it:** call the agent's number and play a shopkeeper. Any unknown number becomes a demo copy of Sri Lakshmi Stores, so you hear the whole flow: last order, offers, out-of-stock swap and the overdue balance.

## How it works

```
Shopkeeper's phone ── Bolna agent ─────────────────────────────── Beat (Next.js on Vercel)
                      ears:   Sarvam saaras:v4 (Kannada / Hindi)   /api/agent/shop      shop, last order, credit, catalog
                      brain:  gpt-5.4-mini                         /api/agent/order     price + book the order
                      voice:  Sarvam bulbul:v4-flash               /api/agent/payment   payment promise
                                                                   /api/agent/callback  call me later
                      post-call webhook ─────────────────────────▶ /api/webhooks/bolna  transcript, recording, status
Dashboard "Start beat" ─▶ /api/beat ─▶ Bolna /call (one call per shop, agent picked by the shop's language)
```

All order logic is on the server, not in the prompt: the agent sends `CODE:qty`, and the server checks stock, applies schemes, totals, and tells the agent what to say. Calling `place_order` again on the same call replaces the order, so the agent can fix mistakes mid-call. Postgres holds shops, products, orders, promises and calls.

## Run it

1. **Database.** Create a free Postgres database (Neon works) and copy its connection string.
2. **Deploy.** Import this repo on Vercel and add the variables from `.env.example`. At minimum: `DATABASE_URL`, `AGENT_TOKEN`, `DASHBOARD_PIN`.
3. **Load demo data.** `DATABASE_URL=... npm run db:setup`
4. **Check without a phone.** `BASE_URL=https://your-app.vercel.app AGENT_TOKEN=... npm run test:agent` plays a full call through the API. Open the dashboard to see it.

## Set up the Bolna agents

Create two agents in Bolna: **Beat Kannada** and **Beat Hindi**.

| Tab | Setting |
| --- | --- |
| Agent | Prompt: paste `bolna/agent-prompt-kannada.md` (or `-hindi.md`). Welcome message: Kannada `ನಮಸ್ಕಾರ, ಶ್ರೀ ಗಣೇಶ್ ಡಿಸ್ಟ್ರಿಬ್ಯೂಟರ್ಸ್ ಇಂದ ಮಾತಾಡ್ತಾ ಇದೀನಿ. ಈಗ ಮಾತಾಡಬಹುದಾ?` / Hindi `नमस्ते, श्री गणेश डिस्ट्रीब्यूटर्स से बात कर रहे हैं। अभी दो मिनट बात हो सकती है?` |
| LLM | `gpt-5.4-mini` |
| Transcriber | Sarvam `saaras:v4`, language `kn` / `hi`, endpointing 500. Keywords: Parle-G, Maggi, Aashirvaad, Kurkure, Puffcorn, Britannia, Marie, Good Day, Hide and Seek, Yippee, Fortune, Gold Winner, Tata Salt, Tata Tea, Red Label, Bru, Colgate, Lifebuoy, Surf Excel, Vim, Lays, Thums Up, Dairy Milk, case, box, carton |
| Voice | Sarvam `bulbul:v4-flash`, a Kannada / Hindi voice from the Languages tab |
| Tools | Add each object in `bolna/tools.json` as a custom function. Replace `YOUR-APP.vercel.app` and `YOUR_AGENT_TOKEN`. |
| Analytics | Webhook URL: `https://YOUR-APP.vercel.app/api/webhooks/bolna?token=YOUR_AGENT_TOKEN` |

Then:
- Attach a phone number to **Beat Kannada** for inbound calls. That's the number you share with judges.
- Put the agent IDs and your Bolna API key in Vercel as `BOLNA_AGENT_ID_KN`, `BOLNA_AGENT_ID_HI` and `BOLNA_API_KEY`.
- On the dashboard, add your own mobile number to a shop and press **Call now**. The agent rings you as that shop.

## Demo data

Five shops on a Bengaluru beat, each with last week's order:

| Shop | Area | Language | Credit due |
| --- | --- | --- | --- |
| Sri Lakshmi Stores | Basavanagudi | Kannada | ₹4,800 |
| Balaji Provision Store | Jayanagar | Kannada | Clear |
| Sharma General Store | BTM Layout | Hindi | Clear |
| Al-Ameen Kirana | Shivajinagar | Hindi | ₹12,300 |
| Annapoorna Super Mart | Malleshwaram | Kannada | ₹2,150 |

The catalog has 25 common products. Maggi 70g has a scheme on 3+ cases, Kurkure Puffcorn is a new launch, and Gold Winner oil is out of stock (the agent offers Fortune instead). Prices are illustrative.

**Reset demo** on the dashboard puts everything back. It keeps any real phone numbers you attached to shops.
