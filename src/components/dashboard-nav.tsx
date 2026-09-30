"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, InboxIcon, KeyIcon, MailIcon, ShieldIcon } from "@/components/icons";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: GridIcon },
  { href: "/dashboard/inbox", label: "Inbox", icon: InboxIcon },
  { href: "/dashboard/aliases", label: "Email aliases", icon: MailIcon },
  { href: "/dashboard/activity", label: "Activity", icon: ShieldIcon },
  { href: "/dashboard/subscription", label: "Subscription", icon: GridIcon },
  { href: "/dashboard/security", label: "Security", icon: KeyIcon },
] as const;

export function DashboardNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [
        ...navItems,
        { href: "/dashboard/admin", label: "Admin dashboard", icon: GridIcon },
        { href: "/dashboard/admin/payments", label: "Payment approvals", icon: ShieldIcon },
      ]
    : navItems;

  return (
    <nav className="sidebar-nav" aria-label="Dashboard navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard"
          ? pathname === href
          : href === "/dashboard/admin"
            ? pathname === href
            : pathname.startsWith(href);

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
