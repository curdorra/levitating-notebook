import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { Book } from "@/components/Book";
import { TopBar } from "@/components/TopBar";
import { Greeting } from "@/components/Greeting";
import { AuthModal } from "@/components/AuthModal";
import { ForgetKey, Sealed } from "@/components/Vault";
import { NewNotebookForm } from "@/components/NotebookActions";
import { aad } from "@/lib/crypto";

export default async function ShelfPage() {
  const user = await getCurrentUser();
  if (!user) return <SignedOutShelf />;

  const notebooks = await db
    .select({
      id: schema.notebooks.id,
      title: schema.notebooks.title,
      titleEnc: schema.notebooks.titleEnc,
      cover: schema.notebooks.cover,
      updatedAt: schema.notebooks.updatedAt,
      pageCount: count(schema.pages.id),
    })
    .from(schema.notebooks)
    .leftJoin(schema.pages, eq(schema.pages.notebookId, schema.notebooks.id))
    .where(eq(schema.notebooks.userId, user.id))
    .groupBy(schema.notebooks.id)
    .orderBy(desc(schema.notebooks.updatedAt));

  return (
    <>
      <TopBar username={user.username} />
      <main className="shelf">
        <header className="shelf-head">
          <p className="eyebrow">
            <Greeting name={user.username} />
          </p>
          <h1 className="display">
            Your <em>shelf</em>
          </h1>
        </header>

        <ul className="shelf-grid">
          {notebooks.map((nb, i) => {
            const title = (
              <Sealed enc={nb.titleEnc} plain={nb.title} context={aad.notebookTitle(nb.id)} fallback="Untitled notebook" />
            );
            return (
            <li key={nb.id}>
              <Link href={`/n/${nb.id}`} className="shelf-item">
                <Book title={title} cover={nb.cover} volume={notebooks.length - i} delay={(i % 5) * -1.3} />
                <span className="shelf-meta">
                  <span className="shelf-title">{title}</span>
                  <span className="shelf-sub">
                    {nb.pageCount} {nb.pageCount === 1 ? "page" : "pages"} ·{" "}
                    {nb.updatedAt.toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </span>
                </span>
              </Link>
            </li>
            );
          })}

          <li>
            <NewNotebookForm />
          </li>
        </ul>

        {notebooks.length === 0 && (
          <p className="shelf-empty">Your shelf is empty. Name your first notebook above to begin.</p>
        )}
      </main>
    </>
  );
}

/** A glimpse of the shelf behind the sign-in popup. */
function SignedOutShelf() {
  const books = ["Morning Pages", "Dreams", "Recipes"];
  return (
    <>
      <main className="shelf shelf-ghost" aria-hidden="true" inert>
        <header className="shelf-head">
          <p className="eyebrow">A private place to write</p>
          <h1 className="display">
            Your <em>shelf</em>
          </h1>
        </header>
        <ul className="shelf-grid">
          {books.map((t, i) => (
            <li key={t}>
              <div className="shelf-item">
                <Book title={t} cover={i + 1} volume={books.length - i} delay={i * -1.3} />
              </div>
            </li>
          ))}
        </ul>
      </main>
      <AuthModal />
      <ForgetKey />
    </>
  );
}
