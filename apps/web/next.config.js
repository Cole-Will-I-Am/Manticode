/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@manticode/shared"],
  output: "export",
  basePath: "/app",
  assetPrefix: "/app",
  trailingSlash: true,
};

module.exports = nextConfig;
