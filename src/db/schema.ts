import {
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { Theme } from "@/lib/themes";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stored lowercase; uniqueness is case-insensitive by construction.
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  // bcrypt of the login key the browser derives from the password (see
  // lib/crypto.ts); the server never receives the password itself. Accounts
  // from before encryption hold bcrypt(password) until their next sign-in.
  passwordHash: text("password_hash").notNull(),
  // 1 once the account has an encryption key; null for pre-encryption accounts.
  encVersion: smallint("enc_version"),
  // The account's data key, wrapped by the password key and by the recovery key.
  wrappedKey: text("wrapped_key"),
  recoveryWrappedKey: text("recovery_wrapped_key"),
  theme: text("theme").$type<Theme>().notNull().default("linen"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie token, so a leaked table can't be replayed.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResets = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const notebooks = pgTable(
  "notebooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Plaintext title, only for notebooks from before encryption.
    title: text("title").notNull().default(""),
    titleEnc: text("title_enc"),
    // Index into the active theme's cover variants (0–3).
    cover: smallint("cover").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notebooks_user_idx").on(t.userId)],
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notebookId: uuid("notebook_id")
      .notNull()
      .references(() => notebooks.id, { onDelete: "cascade" }),
    // Denormalised owner so every page query can be scoped by user directly.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Plaintext title/content, only for pages from before encryption.
    title: text("title").notNull().default(""),
    content: jsonb("content"),
    titleEnc: text("title_enc"),
    contentEnc: text("content_enc"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pages_notebook_idx").on(t.notebookId), index("pages_user_idx").on(t.userId)],
);

// Fixed-window counters for rate limiting, shared by every server instance.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Notebook = typeof notebooks.$inferSelect;
export type Page = typeof pages.$inferSelect;
