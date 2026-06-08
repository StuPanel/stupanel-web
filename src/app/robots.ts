import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/forgot-password", "/pricing"],
        disallow: [
          "/dashboard",
          "/admin",
          "/onboarding",
          "/verify-email",
          "/reset-password",
          "/auth/",
          "/member/",
          "/portal/",
          "/api/",
        ],
      },
    ],
    sitemap: "https://www.stupanel.com/sitemap.xml",
  };
}
