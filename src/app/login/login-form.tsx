"use client";

import { useActionState, useState } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { login, signup, type AuthState } from "./actions";

const initialState: AuthState = {};

export function LoginForm({ allowSignups }: { allowSignups: boolean }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="auth-card">
      <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
      <p>{mode === "login" ? "Sign in to manage your private aliases." : "Start with a protected email identity."}</p>
      <form action={formAction} className="form-grid">
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
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          {!pending && <ArrowRightIcon />}
        </button>
      </form>
      {allowSignups ? (
        <button className="logout-button auth-footnote" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Need an account? Create one" : "Already registered? Sign in"}
        </button>
      ) : (
        <div className="auth-footnote">BatMail is currently a private, invite-only service.</div>
      )}
    </div>
  );
}
