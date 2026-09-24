import Link from "next/link";
import { ThemePicker } from "./ThemePicker";
import { Glyph } from "./SpecimenDeco";
import { SignOutButton } from "./Vault";

export function TopBar({ username, children }: { username: string; children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        Levitating <em>Notebook</em>
      </Link>
      <div className="topbar-middle">
        {children}
        <span className="deco-specimen masthead" aria-hidden="true">
          <Glyph />
        </span>
      </div>
      <nav className="topbar-nav">
        <ThemePicker persist compact />
        <Link href="/settings" className="topbar-link" title="Settings">
          {username}
        </Link>
        <SignOutButton className="topbar-link" />
      </nav>
    </header>
  );
}
