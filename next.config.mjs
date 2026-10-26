/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg"],
  // The demo reset endpoint reads these SQL files at runtime.
  outputFileTracingIncludes: {
    "/api/demo/reset": ["./db/**"],
  },
};

export default nextConfig;
