import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard"><Logo /></Link>
        <DashboardNav />
        <div className="sidebar-bottom">
          <div className="user-chip"><span className="avatar">{initials}</span><div><strong>My account</strong><small>{user.email}</small></div></div>
          <form action={logout}><button className="logout-button">Sign out</button></form>
        </div>
      </aside>
      <section className="app-main">
        <header className="topbar"><span className="topbar-title">Alias dashboard</span><span className="system-status"><i /> Forwarding system ready</span></header>
        {children}
      </section>
    </main>
  );
}
