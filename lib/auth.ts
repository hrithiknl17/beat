import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { one, q } from "./db";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "beat_session";
const SESSION_DAYS = 30;

export type Distributor = {
  id: number;
  name: string;
  owner_name: string;
  email: string;
  city: string;
  phone_number: string | null;
  delivery_note: string;
};

export const DISTRIBUTOR_COLUMNS = "d.id, d.name, d.owner_name, d.email, d.city, d.phone_number, d.delivery_note";

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(key, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(distributorId: number) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await q("insert into sessions (token_hash, distributor_id, expires_at) values ($1, $2, $3)", [sha256(token), distributorId, expires]);
  // Drop this account's expired sessions while we're here.
  await q("delete from sessions where distributor_id = $1 and expires_at < now()", [distributorId]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q("delete from sessions where token_hash = $1", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in distributor, or null. Use in server components and route handlers. */
export async function currentDistributor(): Promise<Distributor | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return one<Distributor>(
    `select ${DISTRIBUTOR_COLUMNS}
       from sessions s join distributors d on d.id = s.distributor_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
}
