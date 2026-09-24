"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logout, upgradeAccount } from "@/app/actions/auth";
import {
  aad,
  createAccountKeys,
  decryptText,
  derivePasswordKeys,
  encryptText,
  unwrapDataKey,
} from "@/lib/crypto";
import { clearKey, clearPendingRecovery, loadKey, saveKey, setPendingRecovery, takePendingRecovery } from "@/lib/vault";

const VaultContext = createContext<CryptoKey | null>(null);

/** The account's data key once this browser has it; null until then. */
export const useVaultKey = () => useContext(VaultContext);

/**
 * Holds the signed-in account's data key for the whole app. If this browser
 * doesn't have it yet (new device, cleared storage), asks for the password to
 * unwrap it. Accounts from before encryption are upgraded here, and their old
 * notes encrypted in the background.
 */
export function VaultProvider({
  username,
  encVersion,
  wrappedKey,
  children,
}: {
  username: string;
  encVersion: number | null;
  wrappedKey: string | null;
  children: React.ReactNode;
}) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [checked, setChecked] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadKey(username).then((k) => {
      if (!live) return;
      setKey(k);
      setChecked(true);
      setRecovery(takePendingRecovery());
    });
    return () => {
      live = false;
    };
  }, [username]);

  useEffect(() => {
    if (key && encVersion) void encryptLegacy(key, username);
  }, [key, encVersion, username]);

  const needsUpgrade = checked && encVersion === null;
  const locked = checked && !needsUpgrade && !key && wrappedKey;

  return (
    <VaultContext.Provider value={key}>
      {children}
      {needsUpgrade && (
        <UpgradeDialog
          username={username}
          onDone={(k, code) => {
            setKey(k);
            setRecovery(code);
          }}
        />
      )}
      {locked && <UnlockDialog username={username} wrappedKey={wrappedKey} onUnlock={setKey} />}
      {key && recovery && (
        <RecoveryDialog
          code={recovery}
          onDone={() => {
            clearPendingRecovery();
            setRecovery(null);
          }}
        />
      )}
    </VaultContext.Provider>
  );
}

/** Decrypts `enc` (or passes through pre-encryption `plain`); null while waiting for the key. */
export function useDecrypted(enc: string | null, plain: string, context: string) {
  const key = useVaultKey();
  const [done, setDone] = useState<{ enc: string; value: string } | null>(null);
  useEffect(() => {
    if (!enc || !key) return;
    let live = true;
    decryptText(key, enc, context).then(
      (value) => live && setDone({ enc, value }),
      () => live && setDone({ enc, value: "⚠ Unreadable" }),
    );
    return () => {
      live = false;
    };
  }, [key, enc, context]);
  if (!enc) return plain;
  return key && done?.enc === enc ? done.value : null;
}

/** An encrypted title, rendered as text once it's decrypted. */
export function Sealed({
  enc,
  plain,
  context,
  fallback,
}: {
  enc: string | null;
  plain: string;
  context: string;
  fallback: string;
}) {
  const value = useDecrypted(enc, plain, context);
  if (value === null) return <span className="sealed" aria-busy="true" />;
  return <>{value.trim() || fallback}</>;
}

/** Forgets this browser's key; used on the signed-out screen. */
export function ForgetKey() {
  useEffect(() => {
    void clearKey();
  }, []);
  return null;
}

// ---------- dialogs ----------

function Dialog({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="modal-scrim vault-scrim">
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="vault-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="vault-title" className="display display-sm">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

function UnlockDialog({
  username,
  wrappedKey,
  onUnlock,
}: {
  username: string;
  wrappedKey: string;
  onUnlock: (key: CryptoKey) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    startTransition(async () => {
      try {
        const { wrapKey } = await derivePasswordKeys(username, password);
        const key = await unwrapDataKey(wrappedKey, wrapKey, aad.passwordWrap(username));
        await saveKey(username, key);
        onUnlock(key);
      } catch {
        setError("That password doesn't unlock this notebook.");
      }
    });
  }

  return (
    <Dialog eyebrow="Locked on this device" title={<>Unlock your <em>notebook</em></>}>
      <p className="form-muted">
        Your notes are encrypted so only you can read them. Enter your password to unlock them in this browser.
      </p>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        {error && (
          <p className="form-msg form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={pending}>
          {pending ? "Unlocking…" : "Unlock"}
        </button>
      </form>
      <SignOutLink />
    </Dialog>
  );
}

function UpgradeDialog({ username, onDone }: { username: string; onDone: (key: CryptoKey, code: string) => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    startTransition(async () => {
      const keys = await createAccountKeys(username, password);
      const fd = new FormData();
      fd.set("legacyPassword", password);
      fd.set("auth", keys.auth);
      fd.set("wrappedKey", keys.wrappedKey);
      fd.set("recoveryWrappedKey", keys.recoveryWrappedKey);
      const res = await upgradeAccount(undefined, fd);
      if (res?.error) return setError(res.error);
      await saveKey(username, keys.localKey);
      setPendingRecovery(keys.recoveryCode);
      onDone(keys.localKey, keys.recoveryCode);
      router.refresh();
    });
  }

  return (
    <Dialog eyebrow="One-time step" title={<>Encrypt your <em>notebook</em></>}>
      <p className="form-muted">
        Notes are now end-to-end encrypted: only you can read them, not even the server. Enter your password once to
        set this up. Your existing notes will be encrypted in this browser.
      </p>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        {error && (
          <p className="form-msg form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={pending}>
          {pending ? "Encrypting…" : "Encrypt my notes"}
        </button>
      </form>
      <SignOutLink />
    </Dialog>
  );
}

export function RecoveryCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function download() {
    const text =
      `Levitating Notebook recovery key\n\n${code}\n\n` +
      "Keep this somewhere safe and private. If you forget your password, it's the only way to get your notes back.\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "levitating-notebook-recovery-key.txt" });
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="recovery">
      <code className="recovery-code">{code}</code>
      <div className="recovery-actions">
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true))}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={download}>
          Download
        </button>
      </div>
    </div>
  );
}

function RecoveryDialog({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <Dialog eyebrow="Save this now" title={<>Your recovery <em>key</em></>}>
      <p className="form-muted">
        If you ever forget your password, this key is the only way to get your notes back. Nobody else has a copy, not
        even us. It won&apos;t be shown again.
      </p>
      <RecoveryCode code={code} />
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I&apos;ve saved it somewhere safe</span>
      </label>
      <button className="btn btn-primary btn-block" disabled={!saved} onClick={onDone}>
        Continue
      </button>
    </Dialog>
  );
}

function SignOutLink() {
  return (
    <p className="form-foot">
      <SignOutButton className="text-btn" />
    </p>
  );
}

/** Signs out and forgets this browser's key. */
export function SignOutButton({ className }: { className: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await clearKey();
          await logout();
        })
      }
    >
      Sign out
    </button>
  );
}

// ---------- pre-encryption notes ----------

type LegacyBatch = {
  notebooks: { id: string; title: string }[];
  pages: { id: string; title: string | null; content: object | null }[];
};

let sweeping = false;

/** Encrypts whatever an upgraded account still holds as plaintext, 50 records at a time. */
async function encryptLegacy(key: CryptoKey, username: string) {
  const flag = `ln-swept:${username}`;
  if (sweeping || sessionStorage.getItem(flag)) return;
  sweeping = true;
  try {
    for (let round = 0; round < 200; round++) {
      const res = await fetch("/api/legacy", { cache: "no-store" });
      if (!res.ok) return;
      const batch = (await res.json()) as LegacyBatch;
      if (!batch.notebooks.length && !batch.pages.length) {
        sessionStorage.setItem(flag, "1");
        return;
      }
      const body = {
        notebooks: await Promise.all(
          batch.notebooks.map(async (n) => ({
            id: n.id,
            titleEnc: await encryptText(key, n.title, aad.notebookTitle(n.id)),
          })),
        ),
        pages: await Promise.all(
          batch.pages.map(async (p) => ({
            id: p.id,
            ...(p.title !== null && { titleEnc: await encryptText(key, p.title, aad.pageTitle(p.id)) }),
            ...(p.content && {
              contentEnc: await encryptText(key, JSON.stringify(p.content), aad.pageContent(p.id)),
            }),
          })),
        ),
      };
      const saved = await fetch("/api/legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!saved.ok) return;
    }
  } catch {
    // Offline or interrupted: it picks up again next time.
  } finally {
    sweeping = false;
  }
}
