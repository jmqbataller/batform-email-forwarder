import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckIcon, ShieldIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { allowSignups } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <Link href="/"><Logo /></Link>
        <div className="auth-quote">
          <h1>Privacy that works <span>quietly.</span></h1>
          <p>Every alias is a shield between your accounts and your real inbox. Turn one off whenever you want.</p>
        </div>
        <div className="auth-proof"><span><ShieldIcon /> Verified delivery</span><span><CheckIcon /> Private by default</span></div>
      </section>
      <section className="auth-main"><LoginForm allowSignups={allowSignups} /></section>
    </main>
  );
}
