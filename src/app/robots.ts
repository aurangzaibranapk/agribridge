import type { MetadataRoute } from "next";

const BASE_URL = "https://alranatraders.pk";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/auth/",
        "/buyer/",
        "/dealer/",
        "/expert/",
        "/login",
        "/forgot-password",
        "/agreement-sign/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
