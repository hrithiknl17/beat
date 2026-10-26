import { Pool, types, type QueryResultRow } from "pg";

// Keep DATE columns as "YYYY-MM-DD" strings so a server timezone can never shift the day.
types.setTypeParser(1082, (v: string) => v);

const globalForPool = globalThis as unknown as { beatPool?: Pool };

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /localhost|127\.0\.0\.1|host=\/|%2Ftmp/.test(url);
  return new Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5,
  });
}

export function pool() {
  if (!globalForPool.beatPool) globalForPool.beatPool = makePool();
  return globalForPool.beatPool;
}

export async function q<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
