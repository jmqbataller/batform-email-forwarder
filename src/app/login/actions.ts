"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { allowSignups, signupAllowedEmail, siteUrl } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(8, "Password must contain at least 8 characters").max(128),
});

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password." };
  redirect("/dashboard");
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!allowSignups || !signupAllowedEmail) {
    return { error: "New accounts are currently invite-only." };
  }
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.email.toLowerCase() !== signupAllowedEmail) {
    return { error: "This email address is not invited to BatMail." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { message: "Check your inbox to confirm your account." };
}
