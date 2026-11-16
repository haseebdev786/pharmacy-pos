// SAVE AS: pharmacy-pos/components/PosSidebar.jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { Badge, Icon, roleTone } from "@/components/ui.jsx";

// Role-filtered menu. The menu only hides links — every page and API
// route still checks the role server-side, so hiding a link here is
// never the security boundary.
const MENU = [
  { label: "Dashboard", href: "/dashboard", roles: ["admin", "pharmacist", "cashier"], icon: "grid", group: "Counter" },
  { label: "POS", href: "/pos", roles: ["admin", "pharmacist", "cashier"], icon: "cart", group: "Counter" },
  { label: "Medicines", href: "/medicines", roles: ["admin", "pharmacist", "cashier"], icon: "pill", group: "Stock" },
  { label: "Inventory", href: "/inventory", roles: ["admin", "pharmacist", "cashier"], icon: "archive", group: "Stock" },
  { label: "Sales", href: "/sales", roles: ["admin", "pharmacist", "cashier"], icon: "receipt", group: "Counter" },
  { label: "Customers", href: "/customers", roles: ["admin", "pharmacist", "cashier"], icon: "users", group: "Business" },
  { label: "Suppliers", href: "/suppliers", roles: ["admin", "pharmacist"], icon: "truck", group: "Stock" },
  { label: "Purchases", href: "/purchases", roles: ["admin", "pharmacist"], icon: "clipboard", group: "Stock" },
  { label: "Expenses", href: "/expenses", roles: ["admin", "pharmacist"], icon: "wallet", group: "Business" },
  { label: "Reports", href: "/reports", roles: ["admin", "pharmacist"], icon: "chart", group: "Business" },
  { label: "Settings", href: "/settings", roles: ["admin"], icon: "gear", group: "Admin" },
  { label: "Users", href: "/users", roles: ["admin"], icon: "user", group: "Admin" },
];

const GROUPS = ["Counter", "Stock", "Business", "Admin"];

export default function PosSidebar({ user, open, onClose }) {
  const pathname = usePathname();
  const visible = MENU.filter((item) => item.roles.includes(user?.role));

  function isActive(href) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="no-print fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-[17rem] max-w-[84vw] flex-col bg-slate-900 text-white shadow-lift transition-transform lg:w-64 lg:max-w-none lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="icon-chip icon-chip-sm">
              <Icon name="pill" className="h-5 w-5" />
            </span>
            <p className="truncate text-lg font-bold">Pharmacy POS</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 lg:hidden"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <nav className="sidebar-nav min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
          {GROUPS.map((group) => {
            const items = visible.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-2">
                <p className="px-3 pb-0.5 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {group}
                </p>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`side-link mb-0.5 ${isActive(item.href) ? "side-link-active" : ""}`}
                  >
                    <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-2.5 px-1">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
            >
              {user?.name?.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-[11px] leading-tight text-slate-400">{user?.email}</p>
            </div>
            <Badge tone={roleTone(user?.role)} className="shrink-0 capitalize">
              {user?.role}
            </Badge>
          </div>
          <div className="mt-2.5">
            <LogoutButton variant="dark" className="btn-block" />
          </div>
        </div>
      </aside>
    </>
  );
}
