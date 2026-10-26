import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "@/lib/db";
import { adminOk, needPin } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Puts the demo back to its starting state: five shops, last week's orders, no calls. */
export async function POST(req: NextRequest) {
  if (!adminOk(req)) return needPin();
  const dir = join(process.cwd(), "db");
  const [schema, seed] = await Promise.all([
    readFile(join(dir, "schema.sql"), "utf8"),
    readFile(join(dir, "seed.sql"), "utf8"),
  ]);
  // Keep any real numbers you attached to the seeded shops.
  const keep = await pool().query<{ id: number; phone: string }>(
    "select id, phone from shops where not is_demo_caller and phone !~ '^90000000'",
  ).catch(() => ({ rows: [] as { id: number; phone: string }[] }));

  await pool().query(schema);
  await pool().query(seed);
  for (const r of keep.rows) await pool().query("update shops set phone = $2 where id = $1", [r.id, r.phone]);
  return NextResponse.json({ ok: true });
}
