import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth">
      <div className="card auth-card">
        <p className="eyebrow">404</p>
        <h1 className="display display-sm">
          This page has <em>drifted off</em>
        </h1>
        <p className="form-muted">It may have been deleted, or it belongs to someone else.</p>
        <Link href="/" className="btn btn-primary">
          Back to your shelf
        </Link>
      </div>
    </main>
  );
}
