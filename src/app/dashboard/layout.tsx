import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { LogOutIcon } from "@/components/icons";
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
        <Link className="sidebar-brand" href="/dashboard"><Logo /></Link>
        <span className="sidebar-label">Workspace</span>
        <DashboardNav />
        <div className="sidebar-bottom">
          <div className="user-chip"><span className="avatar">{initials}</span><div><strong>My account</strong><small>{user.email}</small></div></div>
          <form action={logout}><button className="logout-button"><LogOutIcon /> Sign out</button></form>
        </div>
      </aside>
      <section className="app-main">
        <header className="topbar">
          <div className="topbar-copy"><span>Private email workspace</span><strong>BatMail Console</strong></div>
          <span className="system-status"><i /> All systems operational</span>
        </header>
        {children}
      </section>
    </main>
  );
}
