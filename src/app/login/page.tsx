import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

function safeNext(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect(next);
  }

  const defaultMode = params.mode === "signup" ? "signup" : "login";

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <Link href="/"><Logo /></Link>
        <div className="auth-quote">
          <h1>Privacy that works <span>quietly.</span></h1>
          <p>Create an account for free, get 3 private aliases, and upgrade whenever you need more.</p>
        </div>
        <div className="auth-proof"><span><ShieldIcon /> Verified delivery</span><span><CheckIcon /> Free registration</span></div>
      </section>
      <section className="auth-main"><LoginForm allowSignups defaultMode={defaultMode} next={next} /></section>
    </main>
  );
}
