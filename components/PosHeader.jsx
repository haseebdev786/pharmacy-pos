// SAVE AS: pharmacy-pos/components/PosHeader.jsx
"use client";

import LogoutButton from "@/components/LogoutButton";

export default function PosHeader({ user, onMenuClick }) {
  return (
    <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-lg px-2 py-1 text-xl leading-none text-gray-700 hover:bg-gray-100 lg:hidden"
      >
        &#9776;
      </button>
      <p className="text-base font-semibold text-gray-900">Pharmacy POS</p>
      <div className="ml-auto flex items-center gap-3">
        <p className="hidden text-sm text-gray-700 sm:block">{user?.name}</p>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-700">
          {user?.role}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
