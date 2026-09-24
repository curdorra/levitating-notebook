import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashToken } from "./session";

/** What the reset page needs to re-key in the browser, if the link is still valid. */
export async function resetInfo(token: string) {
  const [row] = await db
    .select({
      username: schema.users.username,
      encVersion: schema.users.encVersion,
      recoveryWrappedKey: schema.users.recoveryWrappedKey,
    })
    .from(schema.passwordResets)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
    .where(and(eq(schema.passwordResets.tokenHash, hashToken(token)), gt(schema.passwordResets.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}
