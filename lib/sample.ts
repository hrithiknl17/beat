import { one, pool } from "./db";

type Product = {
  code: string; name: string; pack: string; price: number;
  scheme_min_qty?: number; scheme_off?: number; scheme_note?: string;
  is_new?: boolean; in_stock?: boolean; substitute?: string;
};

/** A starter catalog of 25 everyday kirana lines, so a new account can take orders on day one. Prices are typical trade prices; edit them in Products. */
export const STARTER_PRODUCTS: Product[] = [
  { code: "PG100", name: "Parle-G 100g", pack: "box of 48", price: 450 },
  { code: "PGG", name: "Parle-G Gold 200g", pack: "box of 24", price: 600 },
  { code: "HNS", name: "Hide & Seek 120g", pack: "box of 24", price: 720 },
  { code: "MRG", name: "Britannia Marie Gold 250g", pack: "box of 24", price: 840 },
  { code: "GDY", name: "Good Day Cashew 200g", pack: "box of 24", price: 960 },
  { code: "MG70", name: "Maggi Masala 70g", pack: "case of 96", price: 1250, scheme_min_qty: 3, scheme_off: 40, scheme_note: "Rs 40 off per case on 3 or more cases this week" },
  { code: "MG4", name: "Maggi Masala 4-pack", pack: "case of 24", price: 1140 },
  { code: "YPE", name: "Yippee Noodles 60g", pack: "case of 96", price: 1100 },
  { code: "AA5", name: "Aashirvaad Atta 5kg", pack: "bag", price: 255, scheme_min_qty: 10, scheme_off: 10, scheme_note: "Rs 10 off per bag on 10 or more bags" },
  { code: "AA10", name: "Aashirvaad Atta 10kg", pack: "bag", price: 495 },
  { code: "FSO", name: "Fortune Sunflower Oil 1L", pack: "carton of 10", price: 1450 },
  { code: "GWO", name: "Gold Winner Sunflower Oil 1L", pack: "carton of 10", price: 1400, in_stock: false, substitute: "FSO" },
  { code: "TSALT", name: "Tata Salt 1kg", pack: "bag of 25", price: 600 },
  { code: "TTP", name: "Tata Tea Premium 250g", pack: "carton of 12", price: 1560 },
  { code: "RLT", name: "Red Label Tea 250g", pack: "carton of 12", price: 1620 },
  { code: "BRU", name: "Bru Instant Coffee 50g", pack: "carton of 12", price: 1500 },
  { code: "CLG", name: "Colgate Strong Teeth 100g", pack: "carton of 24", price: 1250 },
  { code: "LBY", name: "Lifebuoy Soap 4x100g", pack: "carton of 12", price: 1300 },
  { code: "SRF", name: "Surf Excel Easy Wash 1kg", pack: "carton of 10", price: 1300 },
  { code: "VIM", name: "Vim Bar 300g", pack: "carton of 24", price: 680 },
  { code: "KRK", name: "Kurkure Masala Munch Rs 10", pack: "box of 30", price: 270 },
  { code: "LAYS", name: "Lays Magic Masala Rs 10", pack: "box of 30", price: 270 },
  { code: "KPC", name: "Kurkure Puffcorn Rs 10", pack: "box of 30", price: 270, scheme_note: "New on our list this month", is_new: true },
  { code: "THU", name: "Thums Up 750ml", pack: "crate of 24", price: 960 },
  { code: "DMK", name: "Dairy Milk Rs 20", pack: "box of 24", price: 450 },
];

/** Five Bengaluru shops, each with last week's salesman order. Numbers are placeholders until you add real ones. */
const SAMPLE_SHOPS = [
  { name: "Sri Lakshmi Stores", owner: "Ramesh Gowda", area: "Basavanagudi", lang: "kn", due: 4800, dueDays: 18, last: [["PG100", 10], ["MG70", 2], ["TSALT", 2]] },
  { name: "Sharma General Store", owner: "Rajesh Sharma", area: "BTM Layout", lang: "en", due: 0, dueDays: 0, last: [["TTP", 1], ["KRK", 4], ["LAYS", 4]] },
  { name: "Manjunatha Provisions", owner: "Manjunath", area: "Rajajinagar", lang: "kn", due: 12300, dueDays: 34, last: [["MG70", 3], ["THU", 2], ["DMK", 2]] },
  { name: "Al-Ameen Kirana", owner: "Imran", area: "Shivajinagar", lang: "en", due: 0, dueDays: 0, last: [["AA5", 12], ["FSO", 2]] },
  { name: "Annapoorna Super Mart", owner: "Lakshmamma", area: "Malleshwaram", lang: "kn", due: 2150, dueDays: 9, last: [["MRG", 3], ["BRU", 1], ["SRF", 1]] },
] as const;

export async function loadStarterCatalog(distributorId: number) {
  const client = await pool().connect();
  try {
    await client.query("begin");
    for (const p of STARTER_PRODUCTS) {
      await client.query(
        `insert into products (distributor_id, code, name, pack, price, scheme_min_qty, scheme_off, scheme_note, is_new, in_stock, substitute)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (distributor_id, code) do nothing`,
        [distributorId, p.code, p.name, p.pack, p.price, p.scheme_min_qty ?? null, p.scheme_off ?? null, p.scheme_note ?? null, p.is_new ?? false, p.in_stock ?? true, p.substitute ?? null],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return STARTER_PRODUCTS.length;
}

export async function loadSampleShops(distributorId: number) {
  const byCode = new Map(STARTER_PRODUCTS.map((p) => [p.code, p]));
  let added = 0;
  for (const [i, s] of SAMPLE_SHOPS.entries()) {
    const phone = `90000000${String(i + 1).padStart(2, "0")}`;
    const shop = await one<{ id: number }>(
      `insert into shops (distributor_id, name, owner_name, phone, area, language, credit_due, credit_due_since)
       values ($1, $2, $3, $4, $5, $6, $7, case when $7 > 0 then (now() at time zone 'Asia/Kolkata')::date - $8::int end)
       on conflict (distributor_id, phone) do nothing
       returning id`,
      [distributorId, s.name, s.owner, phone, s.area, s.lang, s.due, s.dueDays],
    );
    if (!shop) continue;
    added++;
    const lines = s.last.map(([code, qty]) => {
      const p = byCode.get(code)!;
      const off = p.scheme_min_qty && p.scheme_off && qty >= p.scheme_min_qty ? p.scheme_off : 0;
      return { code, name: p.name, pack: p.pack, qty, price: p.price, off, total: qty * (p.price - off) };
    });
    const subtotal = lines.reduce((t, l) => t + l.qty * l.price, 0);
    const discount = lines.reduce((t, l) => t + l.qty * l.off, 0);
    await one(
      `insert into orders (distributor_id, shop_id, lines, subtotal, discount, total, source, status, paid_by, delivered_at, created_at)
       values ($1, $2, $3::jsonb, $4, $5, $6, 'salesman', 'delivered', 'cash', now() - interval '6 days', now() - interval '7 days')`,
      [distributorId, shop.id, JSON.stringify(lines), subtotal, discount, subtotal - discount],
    );
  }
  return added;
}
