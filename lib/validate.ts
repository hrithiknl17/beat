import { phone10, rupeesIn } from "./http";
import { isLang } from "./lang";

type Parsed = { fields: Record<string, unknown> } | { error: string };

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const has = (b: Record<string, unknown>, k: string) => b[k] !== undefined;

/** Shop fields from a dashboard form. `partial` allows sending only the fields that changed. */
export function readShop(b: Record<string, unknown>, partial: boolean): Parsed {
  const f: Record<string, unknown> = {};
  if (has(b, "name") || !partial) {
    f.name = text(b.name, 80);
    if ((f.name as string).length < 2) return { error: "Enter the shop name." };
  }
  if (has(b, "owner_name")) f.owner_name = text(b.owner_name, 60);
  if (has(b, "area")) f.area = text(b.area, 60);
  if (has(b, "notes")) f.notes = text(b.notes, 300) || null;
  if (has(b, "phone")) {
    const raw = text(b.phone, 20);
    f.phone = raw ? phone10(raw) : null;
    if (raw && !f.phone) return { error: "Enter a 10-digit mobile number." };
  }
  if (has(b, "language")) {
    if (!isLang(b.language)) return { error: "Pick a call language." };
    f.language = b.language;
  }
  if (has(b, "credit_due")) {
    const n = rupeesIn(b.credit_due);
    if (n === null && text(b.credit_due, 20)) return { error: "Credit due must be a rupee amount." };
    f.credit_due = n ?? 0;
  }
  if (has(b, "status")) {
    if (!["active", "paused"].includes(String(b.status))) return { error: "Unknown shop status." };
    f.status = b.status;
  }
  return { fields: f };
}

const intOrNull = (v: unknown) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Product fields from a dashboard form. */
export function readProduct(b: Record<string, unknown>, partial: boolean): Parsed {
  const f: Record<string, unknown> = {};
  if (has(b, "code") || !partial) {
    f.code = text(b.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if ((f.code as string).length < 2) return { error: "Give the product a short code, like MG70." };
  }
  if (has(b, "name") || !partial) {
    f.name = text(b.name, 80);
    if ((f.name as string).length < 2) return { error: "Enter the product name the way shopkeepers say it." };
  }
  if (has(b, "pack") || !partial) {
    f.pack = text(b.pack, 40);
    if (!f.pack) return { error: "Enter the pack, e.g. \"case of 96\"." };
  }
  if (has(b, "price") || !partial) {
    const p = rupeesIn(b.price);
    if (!p) return { error: "Enter the price per pack in rupees." };
    f.price = p;
  }
  if (has(b, "scheme_min_qty")) f.scheme_min_qty = intOrNull(b.scheme_min_qty);
  if (has(b, "scheme_off")) f.scheme_off = intOrNull(b.scheme_off);
  if (has(b, "scheme_note")) f.scheme_note = text(b.scheme_note, 120) || null;
  if (has(b, "is_new")) f.is_new = Boolean(b.is_new);
  if (has(b, "in_stock")) f.in_stock = Boolean(b.in_stock);
  if (has(b, "substitute")) f.substitute = text(b.substitute, 12).toUpperCase() || null;

  if (typeof f.price === "number" && typeof f.scheme_off === "number" && f.scheme_off >= f.price) {
    return { error: "The scheme discount must be less than the price." };
  }
  if ((f.scheme_off == null) !== (f.scheme_min_qty == null) && has(b, "scheme_off") && has(b, "scheme_min_qty")) {
    return { error: "A scheme needs both a minimum quantity and the rupees off." };
  }
  return { fields: f };
}
