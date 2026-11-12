// Place this file at the root of the implemented Next.js project.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

if (basePath && (!basePath.startsWith("/") || basePath.endsWith("/"))) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be empty or start with / without a trailing slash.");
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
