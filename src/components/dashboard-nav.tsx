"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, InboxIcon, KeyIcon, MailIcon, ShieldIcon } from "@/components/icons";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: GridIcon },
  { href: "/dashboard/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/dashboard/aliases", label: "Email aliases", icon: MailIcon },
  { href: "/dashboard/activity", label: "Activity", icon: ShieldIcon },
  { href: "/dashboard/security", label: "Security", icon: KeyIcon },
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="Dashboard navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);

        return (
          <Link key={href} className={active ? "active" : undefined} href={href} aria-current={active ? "page" : undefined}>
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
