import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

const g = globalThis as unknown as { __pgPool?: Pool };

/**
 * Neon (production) is reached over HTTP, which suits serverless functions.
 * Any other Postgres URL, such as the local PGlite server `npm run dev`
 * starts, goes through node-postgres. The query builder API is identical.
 */
function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Run `npm run dev`, or add your Neon connection string.");
  }
  if (new URL(url).hostname.endsWith("neon.tech")) {
    return drizzleNeon(neon(url), { schema });
  }
  // Reuse one pool across hot reloads.
  g.__pgPool ??= new Pool({ connectionString: url, max: 5 });
  return drizzlePg(g.__pgPool, { schema }) as unknown as DB;
}

// Connect on first query, not on import, so `next build` needs no database.
let instance: DB | undefined;
export const db = new Proxy({} as DB, {
  get(_, prop) {
    instance ??= createDb();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
export { schema };
