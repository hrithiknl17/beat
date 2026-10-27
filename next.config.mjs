/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg"],
  // A stray package-lock.json in the home folder otherwise makes Next guess the wrong root.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
