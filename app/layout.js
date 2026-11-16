// Root layout. Imports global styles only — no session or data reads
// here, so login/signup stay shell-free and the dashboard layout and
// AppShell handle the authenticated shell.
import "./globals.css";

export const metadata = {
  title: "Pharmacy POS",
  description:
    "Offline-first Pharmacy POS for a single store: billing, batches, expiry, stock, suppliers, customers, reports.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
