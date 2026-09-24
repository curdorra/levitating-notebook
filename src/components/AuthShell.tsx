import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="auth">
      <Link href="/" className="wordmark">
        Levitating <em>Notebook</em>
      </Link>
      <div className="card auth-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display display-sm">{title}</h1>
        {children}
      </div>
    </main>
  );
}
