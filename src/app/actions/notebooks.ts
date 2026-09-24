"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import * as z from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { MAX_NOTEBOOKS, MAX_PAGES } from "@/lib/limits";
import { cipherSchema } from "@/lib/validation";

// Titles arrive encrypted (lib/crypto.ts); 120 characters of text fits well within this.
const titleSchema = cipherSchema(1024);
const idSchema = z.uuid();

async function countFor(table: typeof schema.notebooks | typeof schema.pages, userId: string) {
  const [row] = await db.select({ n: count() }).from(table).where(eq(table.userId, userId));
  return row.n;
}

async function ownedNotebook(userId: string, notebookId: string) {
  if (!idSchema.safeParse(notebookId).success) return null;
  const [nb] = await db
    .select({ id: schema.notebooks.id })
    .from(schema.notebooks)
    .where(and(eq(schema.notebooks.id, notebookId), eq(schema.notebooks.userId, userId)))
    .limit(1);
  return nb ?? null;
}

/**
 * The browser picks the id, because the encrypted title is bound to it.
 * Returns an error message, or redirects into the new notebook.
 */
export async function createNotebook(id: string, titleEnc: string): Promise<string | void> {
  const user = await requireUser();
  const title = titleSchema.safeParse(titleEnc);
  if (!idSchema.safeParse(id).success || !title.success) return "Something went wrong. Please try again.";
  if ((await countFor(schema.notebooks, user.id)) >= MAX_NOTEBOOKS) {
    return `You've reached the limit of ${MAX_NOTEBOOKS} notebooks.`;
  }
  if ((await countFor(schema.pages, user.id)) >= MAX_PAGES) return `You've reached the limit of ${MAX_PAGES} pages.`;
  const [nb] = await db
    .insert(schema.notebooks)
    .values({ id, userId: user.id, titleEnc: title.data, cover: Math.floor(Math.random() * 4) })
    .returning({ id: schema.notebooks.id });
  const [page] = await db
    .insert(schema.pages)
    .values({ notebookId: nb.id, userId: user.id })
    .returning({ id: schema.pages.id });
  redirect(`/n/${nb.id}/${page.id}`);
}

export async function renameNotebook(notebookId: string, titleEnc: string) {
  const user = await requireUser();
  const parsed = titleSchema.safeParse(titleEnc);
  if (!parsed.success) return;
  await db
    .update(schema.notebooks)
    .set({ titleEnc: parsed.data, title: "", updatedAt: new Date() })
    .where(and(eq(schema.notebooks.id, notebookId), eq(schema.notebooks.userId, user.id)));
  revalidatePath("/");
}

export async function setNotebookCover(notebookId: string, cover: number) {
  const user = await requireUser();
  if (!Number.isInteger(cover) || cover < 0 || cover > 3) return;
  await db
    .update(schema.notebooks)
    .set({ cover })
    .where(and(eq(schema.notebooks.id, notebookId), eq(schema.notebooks.userId, user.id)));
  revalidatePath("/");
}

export async function deleteNotebook(notebookId: string) {
  const user = await requireUser();
  if (!idSchema.safeParse(notebookId).success) return;
  await db
    .delete(schema.notebooks)
    .where(and(eq(schema.notebooks.id, notebookId), eq(schema.notebooks.userId, user.id)));
  redirect("/");
}

/** Returns an error message when the account is full, or redirects to the new page. */
export async function createPage(notebookId: string): Promise<string | void> {
  const user = await requireUser();
  if (!(await ownedNotebook(user.id, notebookId))) redirect("/");
  if ((await countFor(schema.pages, user.id)) >= MAX_PAGES) return `You've reached the limit of ${MAX_PAGES} pages.`;
  const [page] = await db
    .insert(schema.pages)
    .values({ notebookId, userId: user.id })
    .returning({ id: schema.pages.id });
  await touchNotebook(notebookId);
  redirect(`/n/${notebookId}/${page.id}`);
}

export async function deletePage(notebookId: string, pageId: string) {
  const user = await requireUser();
  if (!idSchema.safeParse(pageId).success) return;
  await db
    .delete(schema.pages)
    .where(and(eq(schema.pages.id, pageId), eq(schema.pages.userId, user.id)));
  // The notebook route picks the next page, or makes a fresh one.
  redirect(`/n/${notebookId}`);
}

async function touchNotebook(notebookId: string) {
  await db
    .update(schema.notebooks)
    .set({ updatedAt: new Date() })
    .where(eq(schema.notebooks.id, notebookId));
}
