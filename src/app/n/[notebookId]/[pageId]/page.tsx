import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getNotebook, getPage, listPages } from "@/lib/notebooks";
import { NotebookView } from "@/components/NotebookView";

type Params = Promise<{ notebookId: string; pageId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { notebookId } = await params;
  const user = await requireUser();
  const notebook = await getNotebook(user.id, notebookId);
  // Encrypted titles can only be read in the browser.
  return { title: notebook && !notebook.titleEnc ? notebook.title || "Notebook" : "Notebook" };
}

export default async function PageView({ params }: { params: Params }) {
  const { notebookId, pageId } = await params;
  const user = await requireUser();
  const notebook = await getNotebook(user.id, notebookId);
  if (!notebook) notFound();

  const [page, pages] = await Promise.all([
    getPage(user.id, notebook.id, pageId),
    listPages(user.id, notebook.id),
  ]);
  if (!page) notFound();

  return (
    <NotebookView
      // Remount per page so editor state never bleeds between pages.
      key={page.id}
      username={user.username}
      notebook={{ id: notebook.id, title: notebook.title, titleEnc: notebook.titleEnc }}
      pages={pages.map((p) => ({ id: p.id, title: p.title, titleEnc: p.titleEnc }))}
      page={{
        id: page.id,
        title: page.title,
        titleEnc: page.titleEnc,
        content: page.content as object | null,
        contentEnc: page.contentEnc,
      }}
    />
  );
}
