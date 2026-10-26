import { NextResponse, type NextRequest } from "next/server";

/** Bolna sends the custom function's api_token as the Authorization header. */
export function authorized(req: NextRequest) {
  const token = process.env.AGENT_TOKEN;
  if (!token) return true; // no token configured: open (local dev)
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${token}` || header === token;
}

/** Dashboard actions that cost money or change data need DASHBOARD_PIN (sent as x-beat-pin). Viewing stays public. */
export function adminOk(req: NextRequest) {
  const pin = process.env.DASHBOARD_PIN;
  return !pin || req.headers.get("x-beat-pin") === pin;
}

export function needPin() {
  return NextResponse.json({ error: "Enter the dashboard PIN to do this." }, { status: 401 });
}

/** Seeded demo shops use 90000000xx numbers. Those can't be dialled. */
export const isPlaceholder = (phone: string | null) => !phone || /^90000000\d\d$/.test(phone);

export function denied() {
  return NextResponse.json({ error: "Missing or wrong AGENT_TOKEN in the Authorization header." }, { status: 401 });
}

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

/** Last 10 digits of an Indian mobile number, or null. */
export function phone10(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

export const rupees = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;
