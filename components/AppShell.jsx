// SAVE AS: pharmacy-pos/components/AppShell.jsx
"use client";

import { useState } from "react";
import PosSidebar from "@/components/PosSidebar";
import PosHeader from "@/components/PosHeader";

// Authenticated app shell: fixed sidebar on desktop, overlay drawer on
// mobile, sticky header, and the shared content area. `user` is a plain
// object { name, email, role } passed down from the server layout —
// never a full Prisma user (it carries Dates and fields a client
// component must not receive).
export default function AppShell({ user, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <PosSidebar user={user} open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <PosHeader user={user} onMenuClick={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
