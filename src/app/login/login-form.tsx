"use client";

import { useActionState, useState } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { login, signup, type AuthState } from "./actions";

const initialState: AuthState = {};

export function LoginForm({ allowSignups, defaultMode = "login", next = "/dashboard" }: { allowSignups: boolean; defaultMode?: "login" | "signup"; next?: string }) {
  const [mode, setMode] = useState<"login" | "signup">(defaultMode);
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="auth-card">
      <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
      <p>{mode === "login" ? "Sign in to continue to your BatMail account." : "Register free and start with 3 private aliases."}</p>
      <form action={formAction} className="form-grid">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" ? (
          <div className="field">
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" name="full_name" type="text" autoComplete="name" placeholder="Juan Dela Cruz" minLength={2} maxLength={100} required />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" minLength={8} required />
        </div>
        {state.error && <div className="form-message" role="alert">{state.error}</div>}
        {state.message && <div className="flash" role="status">{state.message}</div>}
        <button className="button button-primary button-large" type="submit" disabled={pending}>
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create free account"}
          {!pending && <ArrowRightIcon />}
        </button>
      </form>
      {allowSignups ? (
        <button
          className="auth-footnote"
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          style={{ width: "100%", border: 0, background: "transparent", color: "var(--accent)", cursor: "pointer", fontWeight: 700 }}
        >
          {mode === "login" ? "New to BatMail? Create a free account" : "Already registered? Sign in"}
        </button>
      ) : (
        <div className="auth-footnote">New registrations are currently unavailable.</div>
      )}
    </div>
  );
}
