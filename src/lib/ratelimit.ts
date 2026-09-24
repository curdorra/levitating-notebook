import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const t = schema.rateLimits;

/**
 * Fixed-window rate limit kept in Postgres, so it holds across every
 * serverless instance. Returns false once `key` has been hit more than `max`
 * times in the current `windowSeconds` window. One atomic upsert per call.
 * Keys are stored hashed, so the table never holds IP addresses or usernames.
 */
export async function allow(rawKey: string, max: number, windowSeconds: number) {
  const key = createHash("sha256").update(`levitating-notebook/rate/${rawKey}`).digest("hex");
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  const [row] = await db
    .insert(t)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`case when ${t.resetAt} < now() then 1 else ${t.count} + 1 end`,
        resetAt: sql`case when ${t.resetAt} < now() then excluded.reset_at else ${t.resetAt} end`,
      },
    })
    .returning({ count: t.count });

  // Now and then, sweep out windows that have ended.
  if (Math.random() < 0.05) {
    await db.delete(t).where(lt(t.resetAt, new Date()));
  }
  return row.count <= max;
}

/**
 * The client's IP. On Vercel both headers are set by the platform and can't
 * be forged by the client; behind another proxy, make sure it overwrites them.
 */
export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
