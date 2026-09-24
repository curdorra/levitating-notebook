"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import * as z from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession, hashToken, newToken, requireUser } from "@/lib/session";
import { sendResetEmail } from "@/lib/mail";
import { TOO_MANY, allow, clientIp } from "@/lib/ratelimit";
import {
  authKeySchema,
  cipherSchema,
  optionalEmailSchema,
  usernameSchema,
  type FormState,
} from "@/lib/validation";

// Compared against when a username doesn't exist, so a login attempt takes
// the same time whether or not the account is real.
const DUMMY_HASH = bcrypt.hashSync("levitating-notebook-dummy", 10);
const BCRYPT_COST = 12;

function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** The key material the browser sends when it sets up (or re-keys) an account. */
const keysSchema = z.object({
  auth: authKeySchema,
  wrappedKey: cipherSchema(),
  recoveryWrappedKey: cipherSchema(),
});

const readKeys = (formData: FormData) =>
  keysSchema.safeParse({
    auth: str(formData, "auth"),
    wrappedKey: str(formData, "wrappedKey"),
    recoveryWrappedKey: str(formData, "recoveryWrappedKey"),
  });

const signupSchema = z.object({ username: usernameSchema, email: optionalEmailSchema });

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const fields = { username: str(formData, "username"), email: str(formData, "email") };
  if (!(await allow(`signup:ip:${await clientIp()}`, 5, 3600))) return { error: TOO_MANY, fields };

  if (str(formData, "agree") !== "1") {
    return { error: "Please accept the terms and privacy policy to continue.", fields };
  }
  const parsed = signupSchema.safeParse({ username: fields.username, email: fields.email });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const keys = readKeys(formData);
  if (!keys.success) return { error: keys.error.issues[0].message, fields };
  const { username, email } = parsed.data;

  let userId: string;
  try {
    const [user] = await db
      .insert(schema.users)
      .values({
        username,
        email,
        passwordHash: await bcrypt.hash(keys.data.auth, BCRYPT_COST),
        encVersion: 1,
        wrappedKey: keys.data.wrappedKey,
        recoveryWrappedKey: keys.data.recoveryWrappedKey,
      })
      .returning({ id: schema.users.id });
    userId = user.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "That username or email is already taken.", fields };
    }
    throw err;
  }

  // The browser stores its key, then navigates; see components/AuthForms.tsx.
  await createSession(userId);
  return { ok: "signed-in" };
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const username = str(formData, "username").trim().toLowerCase();
  const fields = { username };
  const auth = authKeySchema.safeParse(str(formData, "auth"));
  if (!username || !auth.success) return { error: "Enter your username and password.", fields };

  const ip = await clientIp();
  if (!(await allow(`login:ip:${ip}`, 30, 900)) || !(await allow(`login:user:${username}`, 10, 900))) {
    return { error: TOO_MANY, fields };
  }

  const [user] = await db
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash, encVersion: schema.users.encVersion })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  // Accounts from before encryption stored bcrypt(password), so checking them
  // needs the password itself, once. The browser resends it along with fresh
  // keys, and the account is upgraded in the same step. (This reveals that a
  // pre-encryption username exists; new accounts never take this path.)
  if (user && user.encVersion === null) {
    const legacyPassword = str(formData, "legacyPassword");
    if (!legacyPassword) return { legacy: true, fields };
    const keys = readKeys(formData);
    if (!keys.success || !(await bcrypt.compare(legacyPassword, user.passwordHash))) {
      return { error: "Wrong username or password.", fields };
    }
    await upgrade(user.id, keys.data);
    await createSession(user.id);
    return { ok: "signed-in" };
  }

  const valid = await bcrypt.compare(auth.data, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "Wrong username or password.", fields };

  await createSession(user.id);
  const [{ wrappedKey }] = await db
    .select({ wrappedKey: schema.users.wrappedKey })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  // The browser unwraps this with the password key it derived, then navigates.
  return { ok: "signed-in", wrappedKey: wrappedKey ?? undefined };
}

/** A signed-in account from before encryption sets up its keys. */
export async function upgradeAccount(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await allow(`upgrade:user:${user.id}`, 10, 900))) return { error: TOO_MANY };
  const keys = readKeys(formData);
  if (!keys.success) return { error: keys.error.issues[0].message };

  const [row] = await db
    .select({ passwordHash: schema.users.passwordHash, encVersion: schema.users.encVersion })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));
  if (row.encVersion !== null) return { error: "This notebook is already encrypted. Reload the page." };
  if (!(await bcrypt.compare(str(formData, "legacyPassword"), row.passwordHash))) {
    return { error: "That password is wrong." };
  }
  await upgrade(user.id, keys.data);
  return { ok: "Your notebook is now end-to-end encrypted." };
}

async function upgrade(userId: string, keys: z.infer<typeof keysSchema>) {
  await db
    .update(schema.users)
    .set({
      passwordHash: await bcrypt.hash(keys.auth, BCRYPT_COST),
      encVersion: 1,
      wrappedKey: keys.wrappedKey,
      recoveryWrappedKey: keys.recoveryWrappedKey,
    })
    .where(and(eq(schema.users.id, userId), isNull(schema.users.encVersion)));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const who = str(formData, "who").trim().toLowerCase();
  if (!who) return { error: "Enter your username or email." };
  // Same response whether or not the account exists or has an email.
  const done: FormState = {
    ok: "If that account has an email on file, a reset link is on its way. It expires in one hour.",
    fields: { who },
  };
  if (!(await allow(`reset-req:ip:${await clientIp()}`, 10, 3600)) || !(await allow(`reset-req:who:${who}`, 3, 3600))) {
    return { error: TOO_MANY, fields: { who } };
  }

  const [user] = await db
    .select({ id: schema.users.id, username: schema.users.username, email: schema.users.email })
    .from(schema.users)
    .where(or(eq(schema.users.username, who), eq(schema.users.email, who)))
    .limit(1);
  if (!user?.email) return done;

  const token = newToken();
  await db.delete(schema.passwordResets).where(eq(schema.passwordResets.userId, user.id));
  await db.insert(schema.passwordResets).values({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  await sendResetEmail(user.email, user.username, `${appUrl()}/reset/${token}`);
  return done;
}

/**
 * Sets a new password from a reset link. The browser sends one of:
 *  - a data key re-wrapped under the new password, unlocked with the recovery key;
 *  - erase=1 with brand-new keys, which deletes every notebook (no recovery key);
 *  - brand-new keys for an account that predates encryption.
 */
export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  if (!(await allow(`reset:ip:${await clientIp()}`, 10, 900))) return { error: TOO_MANY };
  const token = str(formData, "token");
  const erase = str(formData, "erase") === "1";
  const auth = authKeySchema.safeParse(str(formData, "auth"));
  const wrappedKey = cipherSchema().safeParse(str(formData, "wrappedKey"));
  const recovery = str(formData, "recoveryWrappedKey");
  const recoveryWrappedKey = recovery ? cipherSchema().safeParse(recovery) : null;
  if (!auth.success || !wrappedKey.success || (recoveryWrappedKey && !recoveryWrappedKey.success)) {
    return { error: "Something went wrong. Please try again." };
  }

  const [reset] = await db
    .delete(schema.passwordResets)
    .where(
      and(
        eq(schema.passwordResets.tokenHash, hashToken(token)),
        gt(schema.passwordResets.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.passwordResets.userId });
  if (!reset) return { error: "This reset link has expired or was already used. Request a new one." };

  const [user] = await db
    .select({ encVersion: schema.users.encVersion })
    .from(schema.users)
    .where(eq(schema.users.id, reset.userId));
  const newKeys = erase || user.encVersion === null;
  if (newKeys && !recoveryWrappedKey?.success) return { error: "Something went wrong. Please try again." };

  if (erase) await db.delete(schema.notebooks).where(eq(schema.notebooks.userId, reset.userId));
  await db
    .update(schema.users)
    .set({
      passwordHash: await bcrypt.hash(auth.data, BCRYPT_COST),
      encVersion: 1,
      wrappedKey: wrappedKey.data,
      ...(newKeys && recoveryWrappedKey?.success ? { recoveryWrappedKey: recoveryWrappedKey.data } : {}),
    })
    .where(eq(schema.users.id, reset.userId));

  // Sign out everywhere else, then sign in here.
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, reset.userId));
  await createSession(reset.userId);
  return { ok: "signed-in" };
}
