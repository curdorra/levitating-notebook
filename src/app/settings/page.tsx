import Link from "next/link";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { ThemePicker } from "@/components/ThemePicker";
import {
  DeleteAccountForm,
  EmailForm,
  ExportData,
  PasswordForm,
  RecoveryKeyForm,
} from "@/components/SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const account = { username: user.username, wrappedKey: user.wrappedKey };

  return (
    <>
      <TopBar username={user.username} />
      <main className="settings">
        <header className="shelf-head">
          <p className="eyebrow">Signed in as {user.username}</p>
          <h1 className="display">
            <em>Settings</em>
          </h1>
        </header>

        <section className="card settings-card">
          <h2 className="section-title">Theme</h2>
          <p className="form-muted">Your choice is saved to your account and follows you to every device.</p>
          <ThemePicker persist />
        </section>

        <section className="card settings-card">
          <h2 className="section-title">Password recovery</h2>
          <EmailForm email={user.email} />
        </section>

        <section className="card settings-card">
          <h2 className="section-title">Recovery key</h2>
          <RecoveryKeyForm account={account} />
        </section>

        <section className="card settings-card">
          <h2 className="section-title">Password</h2>
          <PasswordForm account={account} />
        </section>

        <section className="card settings-card">
          <h2 className="section-title">Your data</h2>
          <ExportData />
        </section>

        <section className="card settings-card">
          <h2 className="section-title">Delete account</h2>
          <DeleteAccountForm account={account} />
        </section>

        <p className="legal-links">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
        </p>
      </main>
    </>
  );
}
