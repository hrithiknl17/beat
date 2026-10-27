import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { bad, body } from "@/lib/http";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Create a distributor account and sign in. */
export async function POST(req: NextRequest) {
  const b = await body<{ business_name: string; owner_name: string; email: string; password: string; city: string }>(req);
  const name = String(b.business_name ?? "").trim();
  const owner = String(b.owner_name ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const city = String(b.city ?? "").trim() || "Bengaluru";

  if (name.length < 2) return bad("Enter your business name.");
  if (owner.length < 2) return bad("Enter your name.");
  if (!EMAIL.test(email)) return bad("Enter a valid email address.");
  if (password.length < 8) return bad("Use a password of at least 8 characters.");

  const exists = await one("select 1 from distributors where email = $1", [email]);
  if (exists) return bad("An account with this email already exists. Log in instead.", 409);

  const account = await one<{ id: number }>(
    "insert into distributors (name, owner_name, email, password_hash, city) values ($1, $2, $3, $4, $5) returning id",
    [name.slice(0, 80), owner.slice(0, 60), email, await hashPassword(password), city.slice(0, 60)],
  );
  await createSession(account!.id);
  return NextResponse.json({ ok: true });
}
