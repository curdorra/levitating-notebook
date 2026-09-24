"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthView } from "./AuthModal";
import { login, requestPasswordReset, resetPassword, signup } from "@/app/actions/auth";
import {
  aad,
  createAccountKeys,
  derivePasswordKeys,
  lockDown,
  recoveryWrapKey,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto";
import { saveKey, setPendingRecovery } from "@/lib/vault";
import { passwordSchema, type FormState } from "@/lib/validation";

function Message({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="form-msg form-error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="form-msg form-ok" role="status">{state.ok}</p>;
  return null;
}

const get = (fd: FormData, k: string) => String(fd.get(k) ?? "");

/**
 * Forms whose passwords never leave the browser: on submit, `run` derives keys
 * (lib/crypto.ts) and calls the server action with only the derived values.
 * Once it resolves without an error, the account's key is stored and the
 * signed-in app loads.
 */
function useKeyedForm(run: (fd: FormData) => Promise<FormState>, after: "refresh" | "home" = "refresh") {
  const router = useRouter();
  const [state, setState] = useState<FormState>();
  const [pending, startTransition] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await run(fd);
        setState(res);
        if (!res?.error) {
          if (after === "home") router.replace("/");
          router.refresh();
        }
      } catch (err) {
        setState({ error: err instanceof Error && err.message ? err.message : "Something went wrong. Please try again." });
      }
    });
  };
  return { state, pending, onSubmit };
}

export function LoginForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const { state, pending, onSubmit } = useKeyedForm(async (fd) => {
    const username = get(fd, "username").trim().toLowerCase();
    const password = get(fd, "password");
    const { auth, wrapKey } = await derivePasswordKeys(username, password);
    const out = new FormData();
    out.set("username", username);
    out.set("auth", auth);
    let res = await login(undefined, out);

    // An account from before encryption: prove the password once, set up keys.
    if (res?.legacy) {
      const keys = await createAccountKeys(username, password);
      out.set("legacyPassword", password);
      out.set("wrappedKey", keys.wrappedKey);
      out.set("recoveryWrappedKey", keys.recoveryWrappedKey);
      out.set("auth", keys.auth);
      res = await login(undefined, out);
      if (res?.error) return res;
      await saveKey(username, keys.localKey);
      setPendingRecovery(keys.recoveryCode);
      return res;
    }
    if (res?.error || !res?.wrappedKey) return res;
    await saveKey(username, await unwrapDataKey(res.wrappedKey, wrapKey, aad.passwordWrap(username)));
    return res;
  });

  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        <span>Username</span>
        <input
          name="username"
          defaultValue={state?.fields?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <Message state={state?.error ? state : undefined} />
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Opening…" : "Sign in"}
      </button>
      <p className="form-foot">
        <button type="button" className="text-btn" onClick={() => onSwitch("forgot")}>
          Forgot your password?
        </button>
      </p>
    </form>
  );
}

export function SignupForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const { state, pending, onSubmit } = useKeyedForm(async (fd) => {
    const username = get(fd, "username").trim().toLowerCase();
    const password = get(fd, "password");
    const fields = { username: get(fd, "username"), email: get(fd, "email") };
    // Checked here: the server never sees the password.
    const rules = passwordSchema.safeParse(password);
    if (!rules.success) return { error: rules.error.issues[0].message, fields };
    if (password !== get(fd, "confirm")) return { error: "Passwords don't match.", fields };

    if (!fd.get("agree")) return { error: "Please accept the terms and privacy policy to continue.", fields };

    const keys = await createAccountKeys(username, password);
    const out = new FormData();
    out.set("username", username);
    out.set("email", get(fd, "email"));
    out.set("agree", "1");
    out.set("auth", keys.auth);
    out.set("wrappedKey", keys.wrappedKey);
    out.set("recoveryWrappedKey", keys.recoveryWrappedKey);
    const res = await signup(undefined, out);
    if (res?.error) return res;
    await saveKey(username, keys.localKey);
    setPendingRecovery(keys.recoveryCode);
    return res;
  });

  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        <span>Username</span>
        <input
          name="username"
          defaultValue={state?.fields?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9._\-]+"
          title="Letters, numbers, dots, dashes or underscores"
          required
          autoFocus
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="field">
        <span>
          Email <small>optional, only used to reset your password</small>
        </span>
        <input name="email" type="email" defaultValue={state?.fields?.email} autoComplete="email" />
      </label>
      <label className="check">
        <input type="checkbox" name="agree" value="1" required />
        <span>
          I&apos;m 16 or older and I agree to the{" "}
          <Link href="/terms" target="_blank">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank">
            privacy policy
          </Link>
          .
        </span>
      </label>
      <Message state={state?.error ? state : undefined} />
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Binding your notebook…" : "Create account"}
      </button>
      <p className="form-muted">
        Your notes are end-to-end encrypted. You&apos;ll get a recovery key next: keep it safe, because without it a
        forgotten password means losing your notes.
      </p>
      <p className="form-foot">
        <span>
          Already have one?{" "}
          <button type="button" className="text-btn" onClick={() => onSwitch("login")}>
            Sign in
          </button>
        </span>
      </p>
    </form>
  );
}

export function ForgotForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="form">
      <label className="field">
        <span>Username or email</span>
        <input name="who" defaultValue={state?.fields?.who} autoCapitalize="none" spellCheck={false} required autoFocus />
      </label>
      <Message state={state} />
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="form-muted">
        Didn&apos;t add an email when you signed up? Then there&apos;s no way to send you a link, so you&apos;ll
        need a new account. To keep your notes after a reset, you&apos;ll also need your recovery key.
      </p>
      <p className="form-foot">
        <button type="button" className="text-btn" onClick={() => onSwitch("login")}>
          ← Back to sign in
        </button>
      </p>
    </form>
  );
}

export function ResetForm({
  token,
  username,
  encrypted,
  recoveryWrappedKey,
}: {
  token: string;
  username: string;
  encrypted: boolean;
  recoveryWrappedKey: string | null;
}) {
  const [erase, setErase] = useState(false);
  const { state, pending, onSubmit } = useKeyedForm(async (fd) => {
    const password = get(fd, "password");
    const rules = passwordSchema.safeParse(password);
    if (!rules.success) return { error: rules.error.issues[0].message };
    if (password !== get(fd, "confirm")) return { error: "Passwords don't match." };

    const out = new FormData();
    out.set("token", token);
    let localKey: CryptoKey;

    if (encrypted && !erase) {
      // Unlock the data key with the recovery key and re-wrap it for the new password.
      let dataKey: CryptoKey;
      try {
        const rk = await recoveryWrapKey(get(fd, "recovery"));
        dataKey = await unwrapDataKey(recoveryWrappedKey ?? "", rk, aad.recoveryWrap(username), true);
      } catch {
        return { error: "That recovery key doesn't match this account." };
      }
      const { auth, wrapKey } = await derivePasswordKeys(username, password);
      out.set("auth", auth);
      out.set("wrappedKey", await wrapDataKey(dataKey, wrapKey, aad.passwordWrap(username)));
      localKey = await lockDown(dataKey);
    } else {
      // Brand-new keys: erasing notes, or an account from before encryption.
      const keys = await createAccountKeys(username, password);
      out.set("auth", keys.auth);
      out.set("wrappedKey", keys.wrappedKey);
      out.set("recoveryWrappedKey", keys.recoveryWrappedKey);
      if (erase) out.set("erase", "1");
      localKey = keys.localKey;
      setPendingRecovery(keys.recoveryCode);
    }

    const res = await resetPassword(undefined, out);
    if (res?.error) return res;
    await saveKey(username, localKey);
    return res;
  }, "home");

  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        <span>New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      {encrypted && !erase && (
        <label className="field">
          <span>Recovery key</span>
          <input name="recovery" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
        </label>
      )}
      {encrypted && (
        <label className="check">
          <input type="checkbox" checked={erase} onChange={(e) => setErase(e.target.checked)} />
          <span>I don&apos;t have my recovery key. Erase all my notebooks and start fresh.</span>
        </label>
      )}
      {erase && (
        <p className="form-msg form-error" role="alert">
          Your notes are encrypted with a key only your password or recovery key can open. Without either, they
          can&apos;t be recovered by anyone, so every notebook will be permanently deleted.
        </p>
      )}
      <Message state={state?.error ? state : undefined} />
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Saving…" : erase ? "Erase notes and set password" : "Set new password"}
      </button>
    </form>
  );
}
