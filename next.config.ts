import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // @react-pdf/renderer ships pdfkit and friends with dynamic requires that
  // must stay outside the server bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
