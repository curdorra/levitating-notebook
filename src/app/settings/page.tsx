import Link from "next/link";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { ThemePicker } from "@/components/ThemePicker";
import { SUPPORT_URL } from "@/lib/links";
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
          <h2 className="section-title">Support</h2>
          <p className="form-muted">
            Levitating Notebook is free and has no ads. If it&apos;s a good home for your writing, you can help keep it
            running.
          </p>
          <div>
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-small">
              Support on Ko-fi ↗
            </a>
          </div>
        </section>

        <section className="card settings-card">
          <h2 className="section-title">Delete account</h2>
          <DeleteAccountForm account={account} />
        </section>

        <p className="legal-links">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of service</Link>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            Support
          </a>
        </p>
      </main>
    </>
  );
}
