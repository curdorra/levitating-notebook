import { and, eq, ne, sql } from "drizzle-orm";
import * as z from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { allow } from "@/lib/ratelimit";
import { MAX_PAGE_BYTES, MAX_STORAGE_BYTES } from "@/lib/limits";
import { cipherSchema } from "@/lib/validation";

// Both arrive encrypted in the browser (lib/crypto.ts); the server can't read them.
const bodySchema = z.object({
  titleEnc: cipherSchema(2048).optional(),
  contentEnc: cipherSchema(MAX_PAGE_BYTES).optional(),
});

const p = schema.pages;

/** Bytes an account's other pages take up. */
async function usedElsewhere(userId: string, pageId: string) {
  const [row] = await db
    .select({
      bytes: sql<number>`coalesce(sum(
        coalesce(octet_length(${p.contentEnc}), 0) + coalesce(octet_length(${p.titleEnc}), 0)
        + coalesce(pg_column_size(${p.content}), 0) + octet_length(${p.title})
      ), 0)::bigint`.mapWith(Number),
    })
    .from(p)
    .where(and(eq(p.userId, userId), ne(p.id, pageId)));
  return row.bytes;
}

/**
 * Autosave endpoint. A route handler rather than a server action so the
 * editor can flush with `fetch(..., { keepalive: true })` when the tab closes.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Signed out" }, { status: 401 });
  // Typing saves at most every ~0.7s; this only stops scripted floods.
  if (!(await allow(`save:user:${user.id}`, 300, 60))) {
    return Response.json({ error: "Too many saves" }, { status: 429 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Bad id" }, { status: 400 });

  const raw = await request.text();
  if (raw.length > MAX_PAGE_BYTES + 4096) {
    return Response.json({ error: "This page is too large to save." }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return Response.json({ error: "Bad body" }, { status: 400 });
  const { titleEnc, contentEnc } = body.data;

  if (contentEnc !== undefined && (await usedElsewhere(user.id, id)) + raw.length > MAX_STORAGE_BYTES) {
    return Response.json({ error: "Your notebook storage is full." }, { status: 413 });
  }

  const now = new Date();
  const [page] = await db
    .update(p)
    .set({
      updatedAt: now,
      // Writing the encrypted field also clears any pre-encryption plaintext.
      ...(titleEnc !== undefined && { titleEnc, title: "" }),
      ...(contentEnc !== undefined && { contentEnc, content: null }),
    })
    .where(and(eq(p.id, id), eq(p.userId, user.id)))
    .returning({ notebookId: p.notebookId });
  if (!page) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(schema.notebooks)
    .set({ updatedAt: now })
    .where(eq(schema.notebooks.id, page.notebookId));

  return Response.json({ savedAt: now.toISOString() });
}
