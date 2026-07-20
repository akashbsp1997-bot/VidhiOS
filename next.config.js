/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // app/api/migrate/route.js reads drizzle/*.sql at runtime via
  // drizzle-orm's migrator, not via a static import -- Next's file tracer
  // won't find it on its own, so the migration SQL wouldn't be included in
  // the deployed function bundle without this.
  outputFileTracingIncludes: {
    "/api/migrate": ["./drizzle/**"],
  },
};

export default nextConfig;
