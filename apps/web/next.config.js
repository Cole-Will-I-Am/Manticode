/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@manticode/shared"],
  output: "standalone",
};

module.exports = nextConfig;
