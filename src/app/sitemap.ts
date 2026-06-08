import { MetadataRoute } from "next";

const BASE = "https://www.stupanel.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                        lastModified: new Date(), changeFrequency: "monthly",  priority: 1.0 },
    { url: `${BASE}/login`,             lastModified: new Date(), changeFrequency: "yearly",   priority: 0.8 },
    { url: `${BASE}/register`,          lastModified: new Date(), changeFrequency: "yearly",   priority: 0.9 },
    { url: `${BASE}/forgot-password`,   lastModified: new Date(), changeFrequency: "yearly",   priority: 0.3 },
  ];
}
