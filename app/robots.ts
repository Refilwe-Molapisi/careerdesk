import type { MetadataRoute } from "next";

/** Private app: keep crawlers out entirely. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
