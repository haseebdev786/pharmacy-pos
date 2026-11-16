// SAVE AS: pharmacy-pos/components/PosSidebar.jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

// Role-filtered menu. The menu only hides links — every page and API
// route still checks the role server-side, so hiding a link here is
// never the security boundary.
const MENU = [
  { label: "Dashboard", href: "/dashboard", roles: ["admin", "pharmacist", "cashier"] },
  { label: "POS", href: "/pos", roles: ["admin", "pharmacist", "cashier"] },
  { label: "Medicines", href: "/medicines", roles: ["admin", "pharmacist", "cashier"] },
  { label: "Inventory", href: "/inventory", roles: ["admin", "pharmacist", "cashier"] },
  { label: "Sales", href: "/sales", roles: ["admin", "pharmacist", "cashier"] },
  { label: "Customers", href: "/customers", roles: ["admin", "pharmacist", "cashier"] },
  { label: "Suppliers", href: "/suppliers", roles: ["admin", "pharmacist"] },
  { label: "Purchases", href: "/purchases", roles: ["admin", "pharmacist"] },
  { label: "Expenses", href: "/expenses", roles: ["admin", "pharmacist"] },
  { label: "Reports", href: "/reports", roles: ["admin", "pharmacist"] },
  { label: "Settings", href: "/settings", roles: ["admin"] },
  { label: "Users", href: "/users", roles: ["admin"] },
];

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
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gray-900 text-white transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <p className="text-lg font-bold">Pharmacy POS</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 lg:hidden"
          >
            Close
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {visible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`mb-1 block rounded-lg px-3 py-2 text-sm ${
                isActive(item.href)
                  ? "bg-gray-800 font-medium text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-800 px-4 py-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
          <p className="mt-1 text-xs text-gray-400">
            Role: <span className="font-medium text-white">{user?.role}</span>
          </p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
