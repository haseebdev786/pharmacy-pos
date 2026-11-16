// SAVE AS: pharmacy-pos/components/PosHeader.jsx
"use client";

import LogoutButton from "@/components/LogoutButton";
import { Badge, Icon, roleTone } from "@/components/ui.jsx";

export default function PosHeader({ user, onMenuClick }) {
  return (
    <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-lg px-2 py-1 text-slate-700 hover:bg-slate-100 lg:hidden"
      >
        <Icon name="menu" className="h-6 w-6" />
      </button>
      <p className="text-base font-semibold text-slate-900">Pharmacy POS</p>
      <div className="ml-auto flex items-center gap-3">
        <p className="hidden text-sm text-slate-700 sm:block">{user?.name}</p>
        <Badge tone={roleTone(user?.role)} className="capitalize">
          {user?.role}
        </Badge>
        <LogoutButton />
      </div>
    </header>
  );
}
