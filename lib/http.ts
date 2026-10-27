import { NextResponse, type NextRequest } from "next/server";

/** Bolna sends the custom function's api_token as the Authorization header. */
export function authorized(req: NextRequest) {
  const token = process.env.AGENT_TOKEN;
  if (!token) return process.env.NODE_ENV !== "production"; // open only in local dev
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${token}` || header === token;
}

export function denied() {
  return NextResponse.json({ error: "Missing or wrong AGENT_TOKEN in the Authorization header." }, { status: 401 });
}

export function signedOut() {
  return NextResponse.json({ error: "Your session has ended. Log in again." }, { status: 401 });
}

export function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** Sample shops use 90000000xx numbers. Those can't be dialled. */
export const isPlaceholder = (phone: string | null) => !phone || /^90000000\d\d$/.test(phone);

/**
 * Bolna fills params with "%(name)s" templates. When the LLM skips an optional param
 * the literal template, "None", "null" or an empty string can come through. Treat all of those as missing.
 */
export function clean(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || /^%\(.+\)[sif]$/.test(s) || ["none", "null", "undefined", "nan"].includes(s.toLowerCase())) return null;
  return s;
}

/** Read params from JSON body, form body or query string — whichever Bolna used. */
export async function params(req: NextRequest): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (req.method === "GET") return out;
  const text = await req.text();
  if (!text) return out;
  try {
    return { ...out, ...JSON.parse(text) };
  } catch {
    return { ...out, ...Object.fromEntries(new URLSearchParams(text).entries()) };
  }
}

/** JSON body for dashboard APIs; an unreadable body is an empty object. */
export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<Partial<T>> {
  return ((await req.json().catch(() => ({}))) ?? {}) as Partial<T>;
}

/** Last 10 digits of an Indian mobile number, or null. */
export function phone10(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Whole rupees from user input ("4,800", "Rs 4800"), or null. */
export function rupeesIn(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Math.round(Number(String(v).replace(/[^\d.]/g, "")));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const rupees = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

export function istToday() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
