import Link from "next/link";
import { Contact, LegalPage } from "@/components/LegalPage";
import { LEGAL_UPDATED, operator } from "@/lib/legal";
import { MAX_STORAGE_BYTES } from "@/lib/limits";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  const op = operator();
  const who = op.name ?? "the operator of this site";

  return (
    <LegalPage title="Privacy policy" updated={LEGAL_UPDATED}>
      <p className="lede">
        Levitating Notebook is a private notebook. Your notes are end-to-end encrypted: they are locked in your browser
        before they reach us, and we cannot read them.
      </p>

      <h2>Who is responsible</h2>
      <p>
        Levitating Notebook is run by {who}
        {op.country ? `, based in ${op.country}` : ""}, who is the data controller for the personal data described
        here. Questions and requests: <Contact email={op.email} />.
      </p>

      <h2>End-to-end encryption</h2>
      <p>
        Notebook titles, page titles and page content are encrypted in your browser with a key made from your password.
        Your password itself is never sent to us; we receive only a separate value derived from it, which we store in
        hashed form to check that it&apos;s you. We hold your notes only as encrypted data we have no way to open.
      </p>
      <p>
        This also means we cannot recover your notes for you. If you forget your password and lose your recovery key,
        your notes are gone for good.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your username, your email address if you choose to add one, the hashed login
          value described above, your encryption key in locked form (it can only be unlocked with your password or
          recovery key), your theme choice and when the account was created.
        </li>
        <li>
          <strong>Your notebooks:</strong> the encrypted titles and content, and information we need to run the service
          that is not encrypted: when each notebook and page was created and last changed, how many you have, their
          approximate size and which cover design each notebook uses.
        </li>
        <li>
          <strong>Sign-in sessions:</strong> a record for each device you&apos;re signed in on, kept for up to 30 days
          or until you sign out.
        </li>
        <li>
          <strong>Password reset links:</strong> if you ask for one, a record of it for one hour.
        </li>
        <li>
          <strong>Abuse protection:</strong> to stop password guessing and spam, we count recent attempts per IP address
          and per account. These counters are stored as one-way hashes, not as readable IP addresses or usernames, and
          are deleted once their time window (at most one hour) has passed.
        </li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <p>
        No advertising, no analytics or tracking scripts, no tracking cookies, and we never sell or share your data for
        marketing. Fonts are served from our own site, so loading a page doesn&apos;t contact third parties.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        We set one cookie, <code>ln_session</code>, which keeps you signed in. It is strictly necessary for the
        service, so it doesn&apos;t need consent. Your browser also keeps your encryption key on your device (in a form
        that can&apos;t be copied out by web pages) so you don&apos;t have to unlock your notes on every visit; it is
        removed when you sign out.
      </p>

      <h2>Service providers</h2>
      <p>We use a few companies to run the service. They process data only on our instructions:</p>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the site. Like any web host, it processes your IP address and technical request
          data, and keeps short-lived logs.
        </li>
        <li>
          <strong>Neon</strong> hosts the database where your account and encrypted notes are stored.
        </li>
        <li>
          <strong>Resend</strong> sends password reset emails, only if you added an email address and ask for a reset.
        </li>
      </ul>
      <p>
        These providers may process data outside your country, including in the United States. Where the law requires
        it, transfers are covered by the providers&apos; data processing agreements and the European Commission&apos;s
        Standard Contractual Clauses.
      </p>

      <h2>Why we process your data</h2>
      <p>
        To provide the notebook you signed up for (performance of a contract), and to keep it secure and working,
        including preventing abuse (our legitimate interest in running a safe service). We only use your email address
        to send password reset links.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as you have an account. When you delete your account in Settings, your account and every notebook
        and page are deleted from our database immediately. Copies can remain in our database provider&apos;s backups
        for up to 30 days before they are overwritten. Each account can store up to{" "}
        {Math.round(MAX_STORAGE_BYTES / 1024 / 1024)} MB.
      </p>

      <h2>Your rights</h2>
      <p>Depending on where you live, you have the right to:</p>
      <ul>
        <li>
          <strong>get a copy of your data:</strong> use <em>Download my data</em> in Settings;
        </li>
        <li>
          <strong>correct it:</strong> change your email address in Settings;
        </li>
        <li>
          <strong>delete it:</strong> use <em>Delete account</em> in Settings;
        </li>
        <li>
          <strong>object to or restrict processing</strong>, and to <strong>complain</strong> to your data protection
          authority.
        </li>
      </ul>
      <p>
        For anything else, contact <Contact email={op.email} />. We&apos;ll reply within one month.
      </p>

      <h2>Security</h2>
      <p>
        Besides end-to-end encryption, passwords are never stored or sent, connections are encrypted, sign-in attempts
        are rate-limited, and the site uses a strict content security policy. No system is perfectly secure; if we
        learn of a breach affecting your personal data, we will tell you and the relevant authorities as the law
        requires.
      </p>

      <h2>Age</h2>
      <p>You must be at least 16 years old to use Levitating Notebook.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we&apos;ll update the date above, and tell you in the app before significant changes
        take effect. See also our <Link href="/terms">terms of service</Link>.
      </p>
    </LegalPage>
  );
}
