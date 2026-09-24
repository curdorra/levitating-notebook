"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { THEMES, type Theme } from "@/lib/themes";
import { destroySession, hashToken, requireUser } from "@/lib/session";
import { TOO_MANY, allow } from "@/lib/ratelimit";
import { authKeySchema, cipherSchema, optionalEmailSchema, type FormState } from "@/lib/validation";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function setTheme(theme: Theme) {
  const user = await requireUser();
  if (!THEMES.includes(theme)) return;
  await db.update(schema.users).set({ theme }).where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
}

export async function updateEmail(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const email = optionalEmailSchema.safeParse(formData.get("email") ?? "");
  const fields = { email: str(formData, "email") };
  if (!email.success) return { error: email.error.issues[0].message, fields };

  if (email.data) {
    const [taken] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, email.data), ne(schema.users.id, user.id)))
      .limit(1);
    if (taken) return { error: "That email is already used by another account.", fields };
  }

  await db.update(schema.users).set({ email: email.data }).where(eq(schema.users.id, user.id));
  revalidatePath("/settings");
  return {
    fields,
    ok: email.data ? "Email saved. You can use it to reset your password." : "Email removed.",
  };
}

/**
 * Checks the login key the browser derived from the current password. The
 * rate limit keeps a stolen session from being used to guess the password.
 */
async function verifyCurrent(userId: string, formData: FormData) {
  if (!(await allow(`verify:user:${userId}`, 10, 900))) return TOO_MANY;
  const current = authKeySchema.safeParse(str(formData, "currentAuth"));
  const [row] = await db
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!current.success || !(await bcrypt.compare(current.data, row.passwordHash))) {
    return "Your current password is wrong.";
  }
  return null;
}

/** The browser re-wraps the data key under the new password; notes are untouched. */
export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const problem = await verifyCurrent(user.id, formData);
  if (problem) return { error: problem };
  const auth = authKeySchema.safeParse(str(formData, "auth"));
  const wrappedKey = cipherSchema().safeParse(str(formData, "wrappedKey"));
  if (!auth.success || !wrappedKey.success) return { error: "Something went wrong. Please try again." };

  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(auth.data, 12), wrappedKey: wrappedKey.data })
    .where(eq(schema.users.id, user.id));

  // Sign out every other device, keep this one.
  const current = (await cookies()).get("ln_session")?.value ?? "";
  await db
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, hashToken(current))));
  revalidatePath("/", "layout");
  return { ok: "Password changed. Other devices have been signed out." };
}

/** Replaces the recovery key; the old one stops working. */
export async function replaceRecoveryKey(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const problem = await verifyCurrent(user.id, formData);
  if (problem) return { error: problem };
  const recoveryWrappedKey = cipherSchema().safeParse(str(formData, "recoveryWrappedKey"));
  if (!recoveryWrappedKey.success) return { error: "Something went wrong. Please try again." };

  await db
    .update(schema.users)
    .set({ recoveryWrappedKey: recoveryWrappedKey.data })
    .where(eq(schema.users.id, user.id));
  return { ok: "New recovery key saved. The old one no longer works." };
}

/** Deletes the account and everything in it. Notebooks and pages cascade. */
export async function deleteAccount(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const problem = await verifyCurrent(user.id, formData);
  if (problem) return { error: problem };

  await destroySession();
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  return { ok: "deleted" };
}
