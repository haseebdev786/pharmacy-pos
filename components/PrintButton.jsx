// SAVE AS: pharmacy-pos/components/PrintButton.jsx
"use client";

import { Icon } from "@/components/ui.jsx";

// Prints the current page. The no-print class hides the button itself
// on the printed page (see the @media print rule in app/globals.css).
export default function PrintButton({ label = "Print" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print btn btn-secondary"
    >
      <Icon name="printer" className="h-4 w-4" />
      {label}
    </button>
  );
}
