/** @type {import('next').NextConfig} */
const nextConfig = {
  // The MCP SDK is a native ESM dependency; keep Next from bundling it into
  // the server output (avoids "cannot find module client/index.js" style errors).
  experimental: {
    serverComponentsExternalPackages: ["@modelcontextprotocol/sdk"],
  },
};

export default nextConfig;
