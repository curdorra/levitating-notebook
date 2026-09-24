import Link from "next/link";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="legal">
      <Link href="/" className="wordmark">
        Levitating <em>Notebook</em>
      </Link>
      <article className="card legal-card">
        <p className="eyebrow">Last updated {updated}</p>
        <h1 className="display display-sm">{title}</h1>
        {children}
        <p className="legal-foot">
          <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of service</Link> ·{" "}
          <Link href="/">Back to the notebook</Link>
        </p>
      </article>
    </main>
  );
}

/** How to reach the operator, or a clear note that it hasn't been set. */
export function Contact({ email }: { email: string | null }) {
  return email ? <a href={`mailto:${email}`}>{email}</a> : <strong>[contact email not yet configured]</strong>;
}
