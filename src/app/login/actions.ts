"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(8, "Password must contain at least 8 characters").max(128),
});

const signupSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name").max(100, "Full name is too long"),
});

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password." };
  redirect(next);
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const next = safeNext(formData.get("next"));
  const callbackUrl = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl,
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) return { error: error.message };
  if (data.session) redirect(next);
  return { message: "Account created. Check your inbox to confirm your email, then sign in to continue." };
}
