// SAVE AS: pharmacy-pos/components/PrintButton.jsx
"use client";

// Prints the current page. The no-print class hides the button itself
// on the printed page (see the @media print rule in app/globals.css).
export default function PrintButton({ label = "Print" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {label}
    </button>
  );
}
