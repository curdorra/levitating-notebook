import Link from "next/link";
import { Contact, LegalPage } from "@/components/LegalPage";
import { LEGAL_UPDATED, operator } from "@/lib/legal";
import { MAX_NOTEBOOKS, MAX_PAGES, MAX_STORAGE_BYTES } from "@/lib/limits";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  const op = operator();
  const who = op.name ?? "the operator of this site";

  return (
    <LegalPage title="Terms of service" updated={LEGAL_UPDATED}>
      <p className="lede">
        These terms are an agreement between you and {who} (&ldquo;we&rdquo;) about your use of Levitating Notebook.
        By creating an account, you accept them.
      </p>

      <h2>Who can use it</h2>
      <p>You must be at least 16 years old, and you may only have an account for yourself.</p>

      <h2>Your password and recovery key</h2>
      <p>
        Your notes are end-to-end encrypted with a key only your password or your recovery key can unlock. We never see
        either, so we cannot reset your notes for you. You are responsible for keeping your password and recovery key
        safe. If you lose both, your notes cannot be recovered by anyone, and we are not responsible for that loss.
      </p>

      <h2>Your notes are yours</h2>
      <p>
        You keep all rights to what you write. You allow us only to store and transmit your encrypted notes so the
        service can work. We cannot read them.
      </p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use Levitating Notebook to:</p>
      <ul>
        <li>break the law, or store material that is illegal to possess;</li>
        <li>attack, overload, probe or bypass the security of the service, or access other people&apos;s accounts;</li>
        <li>create accounts automatically or in bulk, or use the service as file storage for others.</li>
      </ul>

      <h2>Limits</h2>
      <p>
        Each account can hold up to {MAX_NOTEBOOKS} notebooks, {MAX_PAGES.toLocaleString("en")} pages and{" "}
        {Math.round(MAX_STORAGE_BYTES / 1024 / 1024)} MB. We may change these limits; if a change affects notes you
        already have, we&apos;ll give you notice first.
      </p>

      <h2>The service</h2>
      <p>
        Levitating Notebook is provided free of charge, &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We work
        to keep it running and your notes safe, but we can&apos;t promise it will always be available or free of
        errors. Please keep your own copies of anything important with <em>Download my data</em> in Settings. We may
        change or stop the service; if we plan to shut it down, we&apos;ll give at least 30 days&apos; notice so you
        can download your notes.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in Settings. We may suspend or close accounts that break these terms or
        put the service or other people at risk; where we reasonably can, we&apos;ll tell you first and give you a
        chance to download your notes.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for loss of data you
        could have prevented by keeping your password, recovery key or an export safe. Nothing in these terms limits
        rights you have under consumer law that cannot be excluded.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We&apos;ll update the date above and tell you in the app before significant changes
        take effect. If you keep using Levitating Notebook afterwards, the new terms apply.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the laws of {op.country ?? "the country where the operator is based"}, without
        taking away the protection of the mandatory laws of the country where you live.
      </p>

      <h2>Contact</h2>
      <p>
        <Contact email={op.email} />. See also our <Link href="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
