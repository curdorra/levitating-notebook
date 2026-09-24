"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteNotebook, deletePage, renameNotebook } from "@/app/actions/notebooks";
import { Editor, Toolbar, type EditorHandle } from "./Editor";
import { ThemePicker } from "./ThemePicker";
import { createSaver, type SaveStatus } from "@/lib/autosave";
import { aad, decryptText, encryptText } from "@/lib/crypto";
import { Brackets } from "./SpecimenDeco";
import { NewPageButton } from "./NotebookActions";
import { useVaultKey } from "./Vault";

// Each field arrives encrypted, or as plaintext from before encryption.
type Sealed = { title: string; titleEnc: string | null };
type Props = {
  username: string;
  notebook: { id: string } & Sealed;
  pages: ({ id: string } & Sealed)[];
  page: { id: string; content: object | null; contentEnc: string | null } & Sealed;
};
type Opened = {
  notebookTitle: string;
  pages: { id: string; title: string }[];
  title: string;
  content: object | null;
};

const reveal = (key: CryptoKey, v: Sealed, context: string) =>
  v.titleEnc ? decryptText(key, v.titleEnc, context) : Promise.resolve(v.title);

/**
 * Decrypts the notebook in the browser, then shows the editor. Until the
 * account's key is available (see Vault.tsx) the page stays closed.
 */
export function NotebookView(props: Props) {
  const key = useVaultKey();
  // The view is remounted per page, so the first props are the ones to open.
  const [sealed] = useState(props);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!key) return;
    let live = true;
    const { notebook, pages, page } = sealed;
    Promise.all([
      reveal(key, notebook, aad.notebookTitle(notebook.id)),
      Promise.all(pages.map(async (p) => ({ id: p.id, title: await reveal(key, p, aad.pageTitle(p.id)) }))),
      reveal(key, page, aad.pageTitle(page.id)),
      page.contentEnc
        ? decryptText(key, page.contentEnc, aad.pageContent(page.id)).then((json) => JSON.parse(json) as object)
        : Promise.resolve(page.content),
    ]).then(
      ([notebookTitle, pageList, title, content]) => live && setOpened({ notebookTitle, pages: pageList, title, content }),
      // Never open an editor over content that failed to decrypt: saving would overwrite it.
      () => live && setBroken(true),
    );
    return () => {
      live = false;
    };
  }, [key, sealed]);

  if (broken) {
    return (
      <main className="empty-notebook card">
        <p className="eyebrow">Can&apos;t open this page</p>
        <p className="form-muted">
          This page couldn&apos;t be decrypted with your key. It hasn&apos;t been changed. Try signing out and in
          again.
        </p>
        <Link href="/" className="btn btn-ghost">
          ← Back to shelf
        </Link>
      </main>
    );
  }
  if (!key || !opened) return <div className="nb-opening" aria-busy="true" />;
  return <NotebookEditor {...props} dataKey={key} opened={opened} />;
}

function NotebookEditor({
  username,
  notebook,
  page,
  dataKey,
  opened,
}: Props & { dataKey: CryptoKey; opened: Opened }) {
  const initialPages = opened.pages;
  const [pages, setPages] = useState(initialPages);
  const [title, setTitle] = useState(opened.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editor, setEditor] = useState<EditorHandle | null>(null);

  // Created once per page; the view is remounted (keyed) for each page.
  const [saver] = useState(() =>
    createSaver(page.id, setStatus, async (patch) => ({
      ...(patch.title !== undefined && {
        titleEnc: await encryptText(dataKey, patch.title, aad.pageTitle(page.id)),
      }),
      ...(patch.content !== undefined && {
        contentEnc: await encryptText(dataKey, JSON.stringify(patch.content), aad.pageContent(page.id)),
      }),
    })),
  );

  // Save on tab hide / close, and when navigating to another page.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void saver.flush({ keepalive: true });
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver.isDirty()) {
        void saver.flush({ keepalive: true });
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void saver.flush({ keepalive: true });
    };
  }, [saver]);

  function onTitle(value: string) {
    setTitle(value);
    setPages((ps) => ps.map((p) => (p.id === page.id ? { ...p, title: value } : p)));
    saver.queue({ title: value });
  }

  const index = pages.findIndex((p) => p.id === page.id);

  return (
    <div className={`notebook ${sidebarOpen ? "sidebar-open" : ""}`}>
      <header className="nb-bar">
        <div className="nb-bar-left">
          <button
            type="button"
            className="icon-btn nb-menu"
            aria-label="Show pages"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((o) => !o)}
          >
            ☰
          </button>
          <Link href="/" className="nb-back" title="Back to shelf">
            ← <span>Shelf</span>
          </Link>
          <NotebookTitle id={notebook.id} initial={opened.notebookTitle} dataKey={dataKey} />
        </div>
        <div className="nb-bar-right">
          <SaveIndicator status={status} />
          <ThemePicker persist compact />
          <Link href="/settings" className="topbar-link nb-user">
            {username}
          </Link>
        </div>
      </header>

      <aside className="nb-sidebar" aria-label="Pages">
        <p className="nb-sidebar-label">Pages</p>
        <ol className="nb-pages">
          {pages.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/n/${notebook.id}/${p.id}`}
                className="nb-page-link"
                aria-current={p.id === page.id ? "page" : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nb-page-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="nb-page-title">{p.title.trim() || "Untitled page"}</span>
              </Link>
            </li>
          ))}
        </ol>
        <NewPageButton notebookId={notebook.id} className="btn btn-ghost btn-block btn-small" label="+ New page" />
        <form
          className="nb-danger"
          action={deleteNotebook.bind(null, notebook.id)}
          onSubmit={(e) => {
            if (!confirm(`Delete “${opened.notebookTitle}” and all its pages? This can't be undone.`)) e.preventDefault();
          }}
        >
          <button className="link-btn">Delete notebook</button>
        </form>
      </aside>
      <div className="nb-scrim" onClick={() => setSidebarOpen(false)} />

      <main className="nb-main">
        <div className="desk">
          <div className="rail">{editor && <Toolbar editor={editor} />}</div>
          <article className="paper">
            <span className="deco-specimen paper-deco" aria-hidden="true">
              <Brackets />
              <span className="paper-art" />
            </span>
            <div className="paper-meta">
              <span>
                Page {String(index + 1).padStart(2, "0")} / {String(pages.length).padStart(2, "0")}
              </span>
              <span className="paper-meta-title">{opened.notebookTitle}</span>
            </div>
            <textarea
              ref={fitTitle}
              className="paper-title"
              rows={1}
              value={title}
              placeholder="Untitled page"
              maxLength={300}
              aria-label="Page title"
              onChange={(e) => {
                onTitle(e.target.value.replace(/\n/g, " "));
                fitTitle(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editor?.commands.focus("start");
                }
              }}
            />
            <Editor
              initialContent={opened.content}
              onChange={(content) => saver.queue({ content })}
              onReady={setEditor}
            />
            <footer className="paper-foot">
              <form
                action={deletePage.bind(null, notebook.id, page.id)}
                onSubmit={(e) => {
                  if (!confirm("Delete this page? This can't be undone.")) e.preventDefault();
                }}
              >
                <button className="link-btn">Delete page</button>
              </form>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}

/** Grow the title box to fit long titles on as many lines as they need. */
function fitTitle(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label = {
    saved: "Saved",
    unsaved: "Editing…",
    saving: "Saving…",
    error: "Offline, retrying…",
  }[status];
  return (
    <span className="save-status" data-status={status} role="status" aria-live="polite">
      <i />
      {label}
    </span>
  );
}

function NotebookTitle({ id, initial, dataKey }: { id: string; initial: string; dataKey: CryptoKey }) {
  const [value, setValue] = useState(initial);
  const saved = useRef(initial);

  function commit() {
    const next = value.trim();
    if (!next) return setValue(saved.current);
    if (next === saved.current) return;
    saved.current = next;
    void encryptText(dataKey, next, aad.notebookTitle(id)).then((enc) => renameNotebook(id, enc));
  }

  return (
    <input
      className="nb-title"
      value={value}
      maxLength={120}
      aria-label="Notebook name"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
