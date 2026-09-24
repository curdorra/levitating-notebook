"use client";

import { useState, useTransition } from "react";
import { createNotebook, createPage } from "@/app/actions/notebooks";
import { aad, encryptText } from "@/lib/crypto";
import { useVaultKey } from "./Vault";

/** Names a new notebook; the title is encrypted before it's sent. */
export function NewNotebookForm() {
  const key = useVaultKey();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!key) return;
    const title = String(new FormData(e.currentTarget).get("title") ?? "").trim().slice(0, 120) || "Untitled notebook";
    startTransition(async () => {
      const id = crypto.randomUUID();
      const problem = await createNotebook(id, await encryptText(key, title, aad.notebookTitle(id)));
      if (problem) setError(problem);
    });
  }

  return (
    <form onSubmit={submit} className="shelf-new">
      <div className="shelf-new-slot">
        <span className="shelf-new-plus">+</span>
      </div>
      <input name="title" placeholder="Name a new notebook" maxLength={120} aria-label="New notebook name" />
      <button className="btn btn-primary btn-small" disabled={!key || pending}>
        {pending ? "Creating…" : "Create"}
      </button>
      {error && (
        <p className="form-msg form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function NewPageButton({ notebookId, className, label }: { notebookId: string; className: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const problem = await createPage(notebookId);
          if (problem) alert(problem);
        })
      }
    >
      {label}
    </button>
  );
}
