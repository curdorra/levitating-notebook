"use client";

import Link from "next/link";
import { useState } from "react";
import { ForgotForm, LoginForm, SignupForm } from "./AuthForms";
import { ThemePicker } from "./ThemePicker";
import { Brackets } from "./SpecimenDeco";

export type AuthView = "login" | "signup" | "forgot";

const HEADINGS: Record<AuthView, { eyebrow: string; title: React.ReactNode }> = {
  login: { eyebrow: "Welcome back", title: <>Open your <em>notebook</em></> },
  signup: { eyebrow: "Begin", title: <>A notebook of <em>your own</em></> },
  forgot: { eyebrow: "It happens", title: <>Forgot your <em>password</em>?</> },
};

/**
 * Sign-in popup shown over the shelf to signed-out visitors. It can't be
 * dismissed: there's nothing behind it until you're signed in.
 */
export function AuthModal() {
  const [view, setView] = useState<AuthView>("login");
  const h = HEADINGS[view];

  return (
    <div className="modal-scrim">
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <Brackets className="deco-specimen modal-brackets" />
        <p className="modal-brand wordmark">
          Levitating <em>Notebook</em>
        </p>

        {view !== "forgot" && (
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={view === "login"} className="tab" onClick={() => setView("login")}>
              Sign in
            </button>
            <button role="tab" aria-selected={view === "signup"} className="tab" onClick={() => setView("signup")}>
              Create account
            </button>
          </div>
        )}

        <p className="eyebrow">{h.eyebrow}</p>
        <h1 id="auth-title" className="display display-sm">
          {h.title}
        </h1>

        {/* key: fresh form state when switching views */}
        {view === "login" && <LoginForm key="login" onSwitch={setView} />}
        {view === "signup" && <SignupForm key="signup" onSwitch={setView} />}
        {view === "forgot" && <ForgotForm key="forgot" onSwitch={setView} />}

        <div className="modal-themes">
          <span className="eyebrow">Theme</span>
          <ThemePicker compact />
        </div>
        <p className="legal-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
