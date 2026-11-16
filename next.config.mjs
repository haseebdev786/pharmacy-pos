// Minimal Next.js config. `cacheComponents` is intentionally NOT enabled:
// without it, `export const instant = ...` is an invalid segment config
// and breaks the build. Pages stay dynamic because they read the session
// and the database on every request, so no segment config is needed.
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
