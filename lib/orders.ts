import type { Sku } from "./shops";

export type Line = { code: string; name: string; pack: string; qty: number; price: number; off: number; total: number };
export type Problem = { said: string; reason: string; suggest?: { code: string; name: string } };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Words of a product name that identify it, e.g. "Parle-G Gold 200g" -> ["parle", "gold"]. */
const nameWords = (name: string) => norm(name).split(" ").filter((w) => w.length >= 3 && !/\d/.test(w));

type Match = { sku: Sku; rest: string } | { ambiguous: Sku[] } | null;

function matchSku(segment: string, skus: Sku[]): Match {
  // 1. Exact code, which is what the agent is told to send.
  for (const sku of skus) {
    const re = new RegExp(`(^|[^a-z0-9])${sku.code.toLowerCase()}([^a-z0-9]|$)`, "i");
    if (re.test(segment)) return { sku, rest: segment.replace(new RegExp(sku.code, "i"), " ") };
  }
  // 2. Fall back to the spoken name ("parle g gold 4 box").
  const text = ` ${norm(segment)} `;
  let best: { sku: Sku; score: number } | null = null;
  let tied: Sku[] = [];
  for (const sku of skus) {
    const words = nameWords(sku.name);
    let score = words.filter((w) => text.includes(` ${w} `)).length;
    if (!score) continue;
    // Size and pack hints break ties between variants (Atta 5kg vs 10kg, Parle-G vs Parle-G Gold).
    for (const m of sku.name.toLowerCase().matchAll(/(\d+)\s*(g|kg|ml|l)\b/g)) if (text.includes(` ${m[1]}${m[2]} `) || text.includes(` ${m[1]} ${m[2]} `)) score += 2;
    if (!best || score > best.score + 0.001) { best = { sku, score }; tied = []; }
    else if (Math.abs(score - best.score) <= 0.001) tied.push(sku);
  }
  if (!best) return null;
  if (tied.length) return { ambiguous: [best.sku, ...tied] };
  const rest = norm(segment)
    .replace(/\b\d+\s*(g|kg|ml|l)\b/g, " ")
    .replace(/\brs\s*\d+\b/g, " ");
  return { sku: best.sku, rest };
}

function quantity(rest: string): number | null {
  const m = rest.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Accepts "PG100:10, MG70:3", "PG100 x 10; Maggi 3", or a JSON array of {code, qty}. */
export function parseItems(raw: string, skus: Sku[]): { lines: Line[]; problems: Problem[] } {
  const wanted = new Map<string, number>();
  const problems: Problem[] = [];
  const byCode = new Map(skus.map((s) => [s.code, s]));

  let segments: string[];
  try {
    const parsed = JSON.parse(raw);
    segments = Array.isArray(parsed)
      ? parsed.map((p) => `${p.code ?? p.name ?? ""}:${p.qty ?? p.quantity ?? ""}`)
      : [raw];
  } catch {
    segments = raw.split(/[,;\n]|\band\b/i);
  }

  for (const seg of segments.map((s) => s.trim()).filter(Boolean)) {
    const hit = matchSku(seg, skus);
    if (!hit) { problems.push({ said: seg, reason: "not on our list" }); continue; }
    if ("ambiguous" in hit) {
      problems.push({ said: seg, reason: `which one: ${hit.ambiguous.map((s) => `${s.name} (${s.code})`).join(" or ")}?` });
      continue;
    }
    const qty = quantity(hit.rest);
    if (!qty) { problems.push({ said: seg, reason: `quantity missing for ${hit.sku.name}` }); continue; }
    if (qty > 200) { problems.push({ said: seg, reason: `${qty} ${hit.sku.pack} looks too high; confirm the quantity` }); continue; }
    if (!hit.sku.in_stock) {
      const alt = hit.sku.substitute ? byCode.get(hit.sku.substitute) : undefined;
      problems.push({ said: seg, reason: `${hit.sku.name} is out of stock this week`, suggest: alt ? { code: alt.code, name: alt.name } : undefined });
      continue;
    }
    wanted.set(hit.sku.code, (wanted.get(hit.sku.code) ?? 0) + qty);
  }

  const lines: Line[] = [...wanted].map(([code, qty]) => {
    const sku = byCode.get(code)!;
    const off = sku.scheme_min_qty && sku.scheme_off && qty >= sku.scheme_min_qty ? sku.scheme_off : 0;
    return { code, name: sku.name, pack: sku.pack, qty, price: sku.price, off, total: qty * (sku.price - off) };
  });
  return { lines, problems };
}

export function totals(lines: Line[]) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const discount = lines.reduce((s, l) => s + l.qty * l.off, 0);
  return { subtotal, discount, total: subtotal - discount };
}
