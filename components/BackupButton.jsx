// SAVE AS: pharmacy-pos/components/BackupButton.jsx
"use client";

import { Icon } from "@/components/ui.jsx";

// Plain download link to the backup API, styled as a button. The
// settings page is Admin-only, and /api/backup re-checks the Admin role
// server-side, so this link cannot leak the database to other roles.
// The honest backup notes live on the settings page, not here.
export default function BackupButton() {
  return (
    <a
      href="/api/backup"
      download
      className="btn btn-primary"
    >
      <Icon name="download" className="h-4 w-4" />
      Download database backup
    </a>
  );
}
