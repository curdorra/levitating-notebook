// Applies ./drizzle migrations. Runs before `next build`, so every Vercel
// deploy brings the database schema up to date. Local dev migrates in
// scripts/dev.mjs instead.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping.");
  process.exit(0);
}

const migrationsFolder = "./drizzle";

if (new URL(url).hostname.endsWith("neon.tech")) {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  await migrate(drizzle(neon(url)), { migrationsFolder });
} else {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder });
  await pool.end();
}
console.log("[migrate] Database schema is up to date.");
