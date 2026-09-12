import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${siteUrl}/dashboard`);
  }
  return NextResponse.redirect(`${siteUrl}/login?error=confirmation`);
}
