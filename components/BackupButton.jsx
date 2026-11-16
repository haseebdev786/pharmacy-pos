// SAVE AS: pharmacy-pos/components/BackupButton.jsx
"use client";

// Plain download link to the backup API, styled as a button. The
// settings page is Admin-only, and /api/backup re-checks the Admin role
// server-side, so this link cannot leak the database to other roles.
// The honest backup notes live on the settings page, not here.
export default function BackupButton() {
  return (
    <a
      href="/api/backup"
      download
      className="inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
    >
      Download database backup
    </a>
  );
}
