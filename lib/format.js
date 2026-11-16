// SAVE AS: pharmacy-pos/lib/format.js
// Money + date helpers. ALL money math in the app goes through round2().
// Prices are stored as Float PKR in SQLite; round2() keeps 2-decimal
// totals exact (e.g. 0.1 + 0.2 never shows as 0.30000000000000004).

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatPKR(n, currency = "Rs") {
  return `${currency} ${round2(n).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysToExpiry(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

export function isExpired(expiryDate) {
  const days = daysToExpiry(expiryDate);
  return days !== null && days < 0;
}
