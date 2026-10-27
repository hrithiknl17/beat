import { NextResponse, type NextRequest } from "next/server";
import { one } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { bad, body } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = await body<{ email: string; password: string }>(req);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!email || !password) return bad("Enter your email and password.");

  const account = await one<{ id: number; password_hash: string }>("select id, password_hash from distributors where email = $1", [email]);
  // Same message either way, so the form doesn't reveal which emails have accounts.
  if (!account || !(await verifyPassword(password, account.password_hash))) return bad("Wrong email or password.", 401);

  await createSession(account.id);
  return NextResponse.json({ ok: true });
}
