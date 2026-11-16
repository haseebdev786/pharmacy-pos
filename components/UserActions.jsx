// SAVE AS: pharmacy-pos/components/UserActions.jsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["admin", "pharmacist", "cashier"];

// Props: { user: { id, name, email, role, isActive }, currentUserId }.
// Role changes and activate/deactivate go through PUT /api/users/[id],
// which re-checks the Admin role and the last-admin protection
// server-side. Controls are disabled for the signed-in Admin's own row:
// nobody may change their own account here.
export default function UserActions({ user, currentUserId }) {
  const router = useRouter();
  const isSelf = user.id === currentUserId;
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function updateUser(patch) {
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not update this user.");
        return false;
      }
      return true;
    } catch {
      setError("Could not reach the server. Check the shop PC is on and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRole() {
    if (role === user.role) return;
    const ok = await updateUser({ role });
    if (ok) router.refresh();
  }

  async function handleToggleActive() {
    const action = user.isActive ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${user.name} (${user.email})?` +
        (user.isActive ? " They will lose access immediately." : "")
    );
    if (!confirmed) return;
    const ok = await updateUser({ isActive: !user.isActive });
    if (ok) router.refresh();
  }

  if (isSelf) {
    return (
      <span className="text-xs text-gray-500">
        You cannot change your own account here.
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        value={role}
        onChange={(event) => setRole(event.target.value)}
        disabled={saving}
        aria-label={`Role for ${user.name}`}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        {ROLES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSaveRole}
        disabled={saving || role === user.role}
        className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        onClick={handleToggleActive}
        disabled={saving}
        className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {user.isActive ? "Deactivate" : "Activate"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
