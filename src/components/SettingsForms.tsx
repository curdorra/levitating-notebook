"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword, deleteAccount, replaceRecoveryKey, updateEmail } from "@/app/actions/account";
import {
  aad,
  decryptText,
  derivePasswordKeys,
  newRecoveryCode,
  recoveryWrapKey,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto";
import { clearKey } from "@/lib/vault";
import { passwordSchema, type FormState } from "@/lib/validation";
import { RecoveryCode, useVaultKey } from "./Vault";

function Message({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="form-msg form-error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="form-msg form-ok" role="status">{state.ok}</p>;
  return null;
}

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "");

type Account = { username: string; wrappedKey: string | null };

/**
 * Proves the current password in the browser: its key must unwrap the
 * account's data key. Returns the login key (for the server to check too) and
 * an extractable copy of the data key, for re-wrapping.
 */
async function unlockWith({ username, wrappedKey }: Account, password: string) {
  const { auth, wrapKey } = await derivePasswordKeys(username, password);
  try {
    const dataKey = await unwrapDataKey(wrappedKey ?? "", wrapKey, aad.passwordWrap(username), true);
    return { auth, dataKey };
  } catch {
    throw new Error("Your current password is wrong.");
  }
}

function useSubmit(run: (fd: FormData) => Promise<FormState>) {
  const [state, setState] = useState<FormState>();
  const [pending, startTransition] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        const res = await run(fd);
        setState(res);
        if (res?.ok) form.reset();
      } catch (err) {
        setState({ error: err instanceof Error ? err.message : "Something went wrong. Please try again." });
      }
    });
  };
  return { state, pending, onSubmit };
}

export function EmailForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(updateEmail, undefined);
  return (
    <form action={action} className="form">
      <label className="field">
        <span>
          Recovery email <small>leave blank to remove</small>
        </span>
        <input name="email" type="email" defaultValue={state?.fields?.email ?? email ?? ""} autoComplete="email" />
      </label>
      <Message state={state} />
      <button className="btn btn-ghost btn-small" disabled={pending}>
        {pending ? "Saving…" : "Save email"}
      </button>
    </form>
  );
}

export function PasswordForm({ account }: { account: Account }) {
  const router = useRouter();
  const { state, pending, onSubmit } = useSubmit(async (fd) => {
    const next = passwordSchema.safeParse(get(fd, "password"));
    if (!next.success) return { error: next.error.issues[0].message };
    if (next.data !== get(fd, "confirm")) return { error: "New passwords don't match." };

    const { auth: currentAuth, dataKey } = await unlockWith(account, get(fd, "current"));
    const { auth, wrapKey } = await derivePasswordKeys(account.username, next.data);
    const out = new FormData();
    out.set("currentAuth", currentAuth);
    out.set("auth", auth);
    out.set("wrappedKey", await wrapDataKey(dataKey, wrapKey, aad.passwordWrap(account.username)));
    const res = await changePassword(undefined, out);
    if (res?.ok) router.refresh();
    return res;
  });
  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        <span>Current password</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <Message state={state} />
      <button className="btn btn-ghost btn-small" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

export function RecoveryKeyForm({ account }: { account: Account }) {
  const [code, setCode] = useState<string | null>(null);
  const { state, pending, onSubmit } = useSubmit(async (fd) => {
    const { auth, dataKey } = await unlockWith(account, get(fd, "current"));
    const fresh = newRecoveryCode();
    const out = new FormData();
    out.set("currentAuth", auth);
    out.set(
      "recoveryWrappedKey",
      await wrapDataKey(dataKey, await recoveryWrapKey(fresh), aad.recoveryWrap(account.username)),
    );
    const res = await replaceRecoveryKey(undefined, out);
    if (res?.ok) setCode(fresh);
    return res;
  });
  return (
    <form onSubmit={onSubmit} className="form">
      <p className="form-muted">
        Lost your recovery key? Make a new one. The old key stops working, so save the new one somewhere safe.
      </p>
      <label className="field">
        <span>Current password</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <Message state={state} />
      {code && <RecoveryCode code={code} />}
      <button className="btn btn-ghost btn-small" disabled={pending}>
        {pending ? "Creating…" : "Create a new recovery key"}
      </button>
    </form>
  );
}

type Exported = {
  username: string;
  email: string | null;
  notebooks: { id: string; title: string; titleEnc: string | null; createdAt: string; updatedAt: string }[];
  pages: {
    id: string;
    notebookId: string;
    title: string;
    titleEnc: string | null;
    content: object | null;
    contentEnc: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
};

type DocNode = { type?: string; text?: string; content?: DocNode[] };

/** Plain text of a Tiptap document: one line per block. */
function toText(node: DocNode | null): string {
  if (!node) return "";
  if (node.text) return node.text;
  const inner = (node.content ?? []).map(toText).join(node.type === "doc" || node.type?.endsWith("List") ? "\n" : "");
  return node.type === "paragraph" || node.type === "heading" || node.type === "listItem" || node.type === "taskItem"
    ? `${inner}\n`
    : inner;
}

/** Downloads everything, decrypted here in the browser. */
export function ExportData() {
  const key = useVaultKey();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!key) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/export", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Exported;
        const title = (enc: string | null, plain: string, ctx: string) =>
          enc ? decryptText(key, enc, ctx) : Promise.resolve(plain);
        const pages = await Promise.all(
          data.pages.map(async (p) => {
            const content = p.contentEnc
              ? (JSON.parse(await decryptText(key, p.contentEnc, aad.pageContent(p.id))) as DocNode)
              : (p.content as DocNode | null);
            return {
              notebookId: p.notebookId,
              title: await title(p.titleEnc, p.title, aad.pageTitle(p.id)),
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
              text: toText(content).trim(),
              content,
            };
          }),
        );
        const notebooks = await Promise.all(
          data.notebooks.map(async (n) => ({
            title: await title(n.titleEnc, n.title, aad.notebookTitle(n.id)),
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            pages: pages
              .filter((p) => p.notebookId === n.id)
              .map((p) => ({ title: p.title, createdAt: p.createdAt, updatedAt: p.updatedAt, text: p.text, content: p.content })),
          })),
        );
        const file = {
          exportedAt: new Date().toISOString(),
          account: { username: data.username, email: data.email },
          notebooks,
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
        const a = Object.assign(document.createElement("a"), {
          href: url,
          download: `levitating-notebook-${new Date().toISOString().slice(0, 10)}.json`,
        });
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setError("The export didn't work. Please try again.");
      }
    });
  }

  return (
    <div className="form">
      <p className="form-muted">
        Download every notebook and page as a JSON file, decrypted here in your browser. It includes plain text of each
        page and its full formatting.
      </p>
      {error && (
        <p className="form-msg form-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-ghost btn-small" disabled={!key || pending} onClick={run}>
        {pending ? "Preparing…" : "Download my data"}
      </button>
    </div>
  );
}

export function DeleteAccountForm({ account }: { account: Account }) {
  const router = useRouter();
  const { state, pending, onSubmit } = useSubmit(async (fd) => {
    if (get(fd, "confirm").trim().toLowerCase() !== "delete") return { error: "Type delete to confirm." };
    const { auth } = await unlockWith(account, get(fd, "current"));
    const out = new FormData();
    out.set("currentAuth", auth);
    const res = await deleteAccount(undefined, out);
    if (res?.error) return res;
    await clearKey();
    router.replace("/");
    router.refresh();
    return undefined;
  });
  return (
    <form onSubmit={onSubmit} className="form">
      <p className="form-muted">
        Permanently deletes your account, every notebook and every page. This can&apos;t be undone. Download your data
        first if you want to keep it.
      </p>
      <label className="field">
        <span>Current password</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>
          Type <strong>delete</strong> to confirm
        </span>
        <input name="confirm" autoComplete="off" required />
      </label>
      <Message state={state} />
      <button className="btn btn-danger btn-small" disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
