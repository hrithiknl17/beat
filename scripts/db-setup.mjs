// Creates the tables and loads demo data. Usage: DATABASE_URL=... npm run db:setup
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}

const local = /localhost|127\.0\.0\.1|host=\/|@\/|%2Ftmp/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(readFileSync(join(root, "db/schema.sql"), "utf8"));
await client.query(readFileSync(join(root, "db/seed.sql"), "utf8"));
const { rows } = await client.query("select count(*)::int as shops from shops");
console.log(`Database ready: ${rows[0].shops} shops loaded.`);
await client.end();
