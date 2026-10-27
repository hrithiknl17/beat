# Beat

A voice order desk for FMCG distributors in India, built on [Bolna](https://bolna.ai).

Distributors send salesmen to visit kirana shops on a fixed route (a "beat") to take restock orders. Beat phones each shop instead. It's built in Bengaluru for Bengaluru: it speaks everyday Kannada and switches to English when the shopkeeper does. Calls are routed by each shop's language, so Hindi, Telugu, Tamil and Malayalam are one more Bolna agent each (prompts for all five are in `bolna/`). On every call it:

- greets the owner by name and reads back the last order
- takes this week's order and prices it against the distributor's own catalog
- applies trade schemes, and offers a substitute when something is out of stock
- asks for a payment date when the shop has overdue credit
- books a callback when the shopkeeper is busy, and rings back at that time
- registers shops that ring in from a number it doesn't know yet

Every order prints on the distributor's dashboard while the call is still going.

## The product

| Section | What the distributor does there |
| --- | --- |
| **Live beat** | Today's numbers, orders printing live, shops on the route, recent calls, follow-ups. *Start beat* calls every active shop. |
| **Orders** | Move each order through packed, out for delivery and delivered (cash, or on credit), or cancel it. |
| **Calls** | Every conversation with its recording and transcript, filterable by outcome. |
| **Shops** | Add, edit, pause or delete shops. Set each shop's number, language and opening balance. New callers show up here to check. |
| **Products** | The catalog the agent sells from: price, pack, schemes, stock and substitutes. A 25-product starter catalog is one click away. |
| **Payments** | Who owes what, promises (open, kept, missed), callbacks, and a record of money received. |
| **Settings** | Business name, delivery promise, the Beat number, and which language agents are live. |

Each distributor has their own account (email and password). All data is scoped to the account.

## How it works

```
Shopkeeper's phone ── Bolna agent (one per language) ──────────── Beat (Next.js on Vercel + Postgres)
                      ears:  Sarvam saaras (kn/hi/te/ta/ml)          /api/agent/shop      shop, last order, credit, catalog
                      brain: LLM                                     /api/agent/order     price + book the order
                      voice: Sarvam bulbul                           /api/agent/payment   payment promise
                                                                     /api/agent/callback  call me later
                                                                     /api/agent/register  new shop rang in
                      post-call webhook ───────────────────────────▶ /api/webhooks/bolna  transcript, recording, status
Dashboard "Start beat" ─▶ /api/beat ─▶ Bolna /call (agent picked by the shop's language)
Cron ─▶ /api/cron/dispatch ─▶ dials callbacks that are due
```

All order logic is on the server, not in the prompt: the agent sends `CODE:qty`, and the server checks stock, applies schemes, totals, and tells the agent what to say. Calling `place_order` again on the same call replaces the order, until the warehouse starts packing it.

Inbound calls are routed by the number dialled: each account sets its Beat number in Settings. Outbound calls are tied to the shop when they're placed.

## Run it locally

```bash
npm install
docker run -d --name beat-pg -e POSTGRES_PASSWORD=beat -e POSTGRES_DB=beat -p 5433:5432 postgres:16-alpine
echo "DATABASE_URL=postgres://postgres:beat@localhost:5433/beat" > .env.local
echo "AGENT_TOKEN=local-dev-token" >> .env.local
DATABASE_URL=postgres://postgres:beat@localhost:5433/beat npm run db:setup
npm run dev
```

Open http://localhost:3000, create an account, and load the starter catalog. Then play a whole call through the API, no phone needed:

```bash
BASE_URL=http://localhost:3000 AGENT_TOKEN=local-dev-token npm run test:agent
```

## Deploy

1. **Database.** Create a free Postgres database (Neon works), then run `DATABASE_URL=... npm run db:setup`.
2. **Vercel.** Import the repo and add the variables from `.env.example`. At minimum `DATABASE_URL`, `AGENT_TOKEN` and `CRON_SECRET`.
3. **Account.** Open the site, sign up, load the starter catalog, add your shops.
4. **Callbacks.** `vercel.json` runs the dispatcher once a day (the Hobby plan limit). For callbacks on time, point a free scheduler such as cron-job.org at `https://YOUR-APP.vercel.app/api/cron/dispatch?secret=CRON_SECRET` every 5 minutes.

## Set up the Bolna agents

`npm run prompts` writes one prompt per language into `bolna/`. Create one agent per language you need (**Beat Kannada**, **Beat Hindi**, **Beat Telugu**, **Beat Tamil**, **Beat Malayalam**):

| Tab | Setting |
| --- | --- |
| Agent | Prompt: paste `bolna/agent-prompt-<language>.md` (kept under Bolna's draft size limit). Welcome message: `bolna/welcome-<language>.txt`. |
| Transcriber | Sarvam, language `kn` / `hi` / `te` / `ta` / `ml`. Add brand names as keywords: Parle-G, Maggi, Aashirvaad, Kurkure, Britannia, Good Day, Fortune, Tata Salt, Surf Excel, Colgate, Lifebuoy… |
| Voice | Sarvam bulbul, a voice for that language |
| Tools | Add each object in `bolna/tools.json` as a custom function. Replace `YOUR-APP.vercel.app` and `YOUR_AGENT_TOKEN`. |
| Analytics | Webhook URL: `https://YOUR-APP.vercel.app/api/webhooks/bolna?token=YOUR_AGENT_TOKEN` |

Then:
- Attach a phone number to one agent for inbound calls, and enter that number as your Beat number in Settings.
- Put the agent IDs and your Bolna API key in Vercel: `BOLNA_API_KEY`, `BOLNA_AGENT_ID_KN`, `_HI`, `_TE`, `_TA`, `_ML`.
- Add your own mobile number to a shop and press **Call**. The agent rings you as that shop.

Have a native speaker read each prompt's welcome line before going live.
