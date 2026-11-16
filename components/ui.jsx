// SAVE AS: pharmacy-pos/components/ui.jsx
// Shared PRESENTATIONAL components only: no data fetching, no hooks,
// no "use client" (server components import this file too). Icons are
// inline SVG — no icon package, no webfonts, offline-safe.
//
// Exports: Icon, PageHeader, StatCard, Badge, EmptyState, roleTone.
// Every usage must keep the original text, values, handlers and links.

const PATHS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 11.4a1.5 1.5 0 0 0 1.5 1.1h7.9a1.5 1.5 0 0 0 1.5-1.2L20 8H6" />
    </>
  ),
  pill: (
    <>
      <rect
        x="3.5"
        y="8.5"
        width="17"
        height="7"
        rx="3.5"
        transform="rotate(-45 12 12)"
      />
      <path d="M9.5 9.5l5 5" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 13h4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.5a4.5 4.5 0 0 1 4.5 4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  truck: (
    <>
      <path d="M2 5h11v11H2z" />
      <path d="M13 9h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 11h6M9 15h4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M16 15h2" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <rect x="7" y="12" width="3" height="5" />
      <rect x="12" y="8" width="3" height="9" />
      <rect x="17" y="5" width="3" height="12" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  alert: (
    <>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 10v4.5" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  package: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  printer: (
    <>
      <path d="M7 8V4h10v4" />
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
      <rect x="7" y="13" width="10" height="7" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6.5 9.5h.01M17.5 14.5h.01" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  return: (
    <>
      <path d="M4 9a8 8 0 0 1 14-3M20 15a8 8 0 0 1-14 3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  logout: (
    <>
      <path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" />
      <path d="M10 12h11M17 8l4 4-4 4" />
    </>
  ),
};

export function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name] ?? PATHS.grid}
    </svg>
  );
}

// Page header: title + optional description + optional action buttons.
// `description` and `actions` accept nodes so existing conditional
// content (counts, search terms) passes through unchanged.
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description ? <div className="page-desc">{description}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

// Stat card: label + big value + optional icon chip. Tones only change
// the icon chip color: "default" | "amber" | "red" | "blue" | "slate".
export function StatCard({ label, value, icon, tone = "default" }) {
  const chip =
    tone === "amber"
      ? "icon-chip icon-chip-amber"
      : tone === "red"
        ? "icon-chip icon-chip-red"
        : tone === "blue"
          ? "icon-chip icon-chip-blue"
          : tone === "slate"
            ? "icon-chip icon-chip-slate"
            : "icon-chip";
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {icon ? (
          <span className={chip}>
            <Icon name={icon} className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

const BADGE_TONES = {
  green: "badge badge-green",
  emerald: "badge badge-emerald",
  amber: "badge badge-amber",
  red: "badge badge-red",
  slate: "badge badge-slate",
  blue: "badge badge-blue",
};

// Status badge. Tones: "green" | "emerald" | "amber" | "red" | "slate" | "blue".
export function Badge({ tone = "slate", children, className }) {
  return (
    <span
      className={`${BADGE_TONES[tone] ?? BADGE_TONES.slate}${className ? ` ${className}` : ""}`}
    >
      {children}
    </span>
  );
}

// Role -> badge tone, used by the header and user lists.
export function roleTone(role) {
  if (role === "admin") return "emerald";
  if (role === "pharmacist") return "blue";
  return "slate";
}

// Empty state card: icon chip + title + optional description + optional
// action (the existing link/button node, passed through unchanged).
export function EmptyState({ icon = "package", title, children, action }) {
  return (
    <div className="card card-pad text-center">
      <span className="icon-chip mx-auto">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-900">{title}</p>
      {children ? (
        <div className="mt-1 text-sm text-slate-500">{children}</div>
      ) : null}
      {action ? (
        <div className="mt-4 flex justify-center">{action}</div>
      ) : null}
    </div>
  );
}
