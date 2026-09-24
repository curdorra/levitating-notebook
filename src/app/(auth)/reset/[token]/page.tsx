import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "@/components/AuthForms";
import { resetInfo } from "@/lib/reset";

export const metadata = { title: "Reset password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await resetInfo(token);

  if (!info) {
    return (
      <AuthShell eyebrow="Link expired" title={<>Try <em>again</em></>}>
        <p className="form-muted">This reset link has expired or was already used. Request a new one from the sign-in screen.</p>
        <Link href="/" className="btn btn-primary btn-block">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  const encrypted = info.encVersion !== null;
  return (
    <AuthShell eyebrow="Almost there" title={<>Choose a new <em>password</em></>}>
      {encrypted && (
        <p className="form-muted">
          Your notes are end-to-end encrypted, so you&apos;ll need the recovery key you saved when you signed up.
        </p>
      )}
      <ResetForm
        token={token}
        username={info.username}
        encrypted={encrypted}
        recoveryWrappedKey={info.recoveryWrappedKey}
      />
    </AuthShell>
  );
}
