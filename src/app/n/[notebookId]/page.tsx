import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getNotebook, listPages } from "@/lib/notebooks";
import { NewPageButton } from "@/components/NotebookActions";
import { Sealed } from "@/components/Vault";
import { aad } from "@/lib/crypto";
import { TopBar } from "@/components/TopBar";

// Opening a notebook lands on its most recently edited page.
export default async function NotebookIndex({ params }: { params: Promise<{ notebookId: string }> }) {
  const { notebookId } = await params;
  const user = await requireUser();
  const notebook = await getNotebook(user.id, notebookId);
  if (!notebook) notFound();

  const pages = await listPages(user.id, notebook.id);
  if (pages.length > 0) {
    const latest = pages.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
    redirect(`/n/${notebook.id}/${latest.id}`);
  }

  return (
    <>
      <TopBar username={user.username} />
      <main className="empty-notebook card">
        <p className="eyebrow">
          <Sealed enc={notebook.titleEnc} plain={notebook.title} context={aad.notebookTitle(notebook.id)} fallback="Notebook" />
        </p>
        <h1 className="display display-sm">
          No pages <em>yet</em>
        </h1>
        <NewPageButton notebookId={notebook.id} className="btn btn-primary" label="Start the first page" />
      </main>
    </>
  );
}
