import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import * as z from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { MAX_PAGE_BYTES } from "@/lib/limits";
import { cipherSchema } from "@/lib/validation";

/**
 * One-time encryption of notes written before end-to-end encryption. The
 * browser GETs whatever is still plaintext, encrypts it, and POSTs it back;
 * the server stores the ciphertext and clears the plaintext.
 */

const BATCH = 50;
const nb = schema.notebooks;
const pg = schema.pages;

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.encVersion) return Response.json({ error: "Not ready" }, { status: 401 });

  const [notebooks, pages] = await Promise.all([
    db.select({ id: nb.id, title: nb.title }).from(nb).where(and(eq(nb.userId, user.id), isNull(nb.titleEnc))).limit(BATCH),
    db
      .select({ id: pg.id, title: pg.title, content: pg.content, titleEnc: pg.titleEnc })
      .from(pg)
      .where(and(eq(pg.userId, user.id), or(isNull(pg.titleEnc), and(isNull(pg.contentEnc), isNotNull(pg.content)))))
      .limit(BATCH),
  ]);
  return Response.json(
    {
      notebooks,
      pages: pages.map((p) => ({ id: p.id, title: p.titleEnc ? null : p.title, content: p.content })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const postSchema = z.object({
  notebooks: z.array(z.object({ id: z.uuid(), titleEnc: cipherSchema(1024) })).max(BATCH),
  pages: z
    .array(
      z.object({
        id: z.uuid(),
        titleEnc: cipherSchema(2048).optional(),
        contentEnc: cipherSchema(MAX_PAGE_BYTES).optional(),
      }),
    )
    .max(BATCH),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.encVersion) return Response.json({ error: "Not ready" }, { status: 401 });
  const body = postSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Bad body" }, { status: 400 });

  for (const n of body.data.notebooks) {
    await db
      .update(nb)
      .set({ titleEnc: n.titleEnc, title: "" })
      .where(and(eq(nb.id, n.id), eq(nb.userId, user.id), isNull(nb.titleEnc)));
  }
  // Only fill fields that are still plaintext, so an autosave that landed in
  // the meantime (already encrypted, and newer) is never overwritten.
  for (const p of body.data.pages) {
    const mine = and(eq(pg.id, p.id), eq(pg.userId, user.id));
    if (p.titleEnc) {
      await db.update(pg).set({ titleEnc: p.titleEnc, title: "" }).where(and(mine, isNull(pg.titleEnc)));
    }
    if (p.contentEnc) {
      await db.update(pg).set({ contentEnc: p.contentEnc, content: null }).where(and(mine, isNull(pg.contentEnc)));
    }
  }
  return Response.json({ ok: true });
}
