import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { allow } from "@/lib/ratelimit";

/**
 * Everything an account holds, still encrypted. The browser decrypts it and
 * builds the download (see components/AccountForms.tsx), so plaintext never
 * passes through the server.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Signed out" }, { status: 401 });
  if (!(await allow(`export:user:${user.id}`, 20, 3600))) {
    return Response.json({ error: "Too many exports" }, { status: 429 });
  }

  const [notebooks, pages] = await Promise.all([
    db
      .select({
        id: schema.notebooks.id,
        title: schema.notebooks.title,
        titleEnc: schema.notebooks.titleEnc,
        createdAt: schema.notebooks.createdAt,
        updatedAt: schema.notebooks.updatedAt,
      })
      .from(schema.notebooks)
      .where(eq(schema.notebooks.userId, user.id))
      .orderBy(asc(schema.notebooks.createdAt)),
    db
      .select({
        id: schema.pages.id,
        notebookId: schema.pages.notebookId,
        title: schema.pages.title,
        titleEnc: schema.pages.titleEnc,
        content: schema.pages.content,
        contentEnc: schema.pages.contentEnc,
        createdAt: schema.pages.createdAt,
        updatedAt: schema.pages.updatedAt,
      })
      .from(schema.pages)
      .where(eq(schema.pages.userId, user.id))
      .orderBy(asc(schema.pages.createdAt)),
  ]);

  return Response.json(
    { username: user.username, email: user.email, notebooks, pages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
