// SAVE AS: pharmacy-pos/app/api/backup/route.js
// Database backup download. ADMIN ONLY. Streams the live SQLite file
// (prisma/dev.db) as a download.
//
// Honest limit: this is a best-effort copy of the live file while the
// server is running. The reliable backup is copying prisma/dev.db while
// the server is stopped. Copy the downloaded file to a USB stick or
// another PC — if the shop PC's hard disk dies with no backup copy
// elsewhere, the data is gone.
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, hasRole } from "@/lib/session";

function resolveDatabasePath() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // Expected forms: file:./dev.db (relative) or file:/abs/path/dev.db.
  if (!url.startsWith("file:")) return null;
  let filePart = url.slice("file:".length).split("?")[0];
  if (!filePart) return null;
  if (path.isAbsolute(filePart)) return filePart;
  // Prisma resolves a relative SQLite path from the schema folder,
  // which is <project>/prisma/. The server runs from the project root.
  return path.resolve(process.cwd(), "prisma", filePart);
}

function backupFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `pharmacy-pos-backup-${year}-${month}-${day}.db`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!hasRole(user, ["admin"])) {
    return NextResponse.json(
      { error: "Only Admin can download a backup." },
      { status: 403 }
    );
  }

  const dbPath = resolveDatabasePath();
  if (!dbPath) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set to a SQLite file path." },
      { status: 500 }
    );
  }

  let buffer;
  try {
    buffer = await readFile(dbPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return NextResponse.json(
        { error: "Database file not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Could not read the database file." },
      { status: 500 }
    );
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="${backupFileName()}"`,
    },
  });
}
