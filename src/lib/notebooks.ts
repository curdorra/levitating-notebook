import "server-only";
import { and, asc, eq } from "drizzle-orm";
import * as z from "zod";
import { db, schema } from "@/db";

const isUuid = (v: string) => z.uuid().safeParse(v).success;

export async function getNotebook(userId: string, notebookId: string) {
  if (!isUuid(notebookId)) return null;
  const [nb] = await db
    .select()
    .from(schema.notebooks)
    .where(and(eq(schema.notebooks.id, notebookId), eq(schema.notebooks.userId, userId)))
    .limit(1);
  return nb ?? null;
}

/** Page list for the sidebar, in the order they were written. */
export function listPages(userId: string, notebookId: string) {
  return db
    .select({
      id: schema.pages.id,
      title: schema.pages.title,
      titleEnc: schema.pages.titleEnc,
      updatedAt: schema.pages.updatedAt,
    })
    .from(schema.pages)
    .where(and(eq(schema.pages.notebookId, notebookId), eq(schema.pages.userId, userId)))
    .orderBy(asc(schema.pages.createdAt));
}

export async function getPage(userId: string, notebookId: string, pageId: string) {
  if (!isUuid(pageId)) return null;
  const [page] = await db
    .select()
    .from(schema.pages)
    .where(
      and(
        eq(schema.pages.id, pageId),
        eq(schema.pages.notebookId, notebookId),
        eq(schema.pages.userId, userId),
      ),
    )
    .limit(1);
  return page ?? null;
}
