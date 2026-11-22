/**
 * Clears the cached copy of studio websites so the next visit shows the new version at once.
 * Called by the API after Publish / Unpublish / an address change. It only empties a cache
 * (the next visitor reads the site from the API again), so it needs no login.
 */
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { slugs?: unknown } | null;
  const slugs = (Array.isArray(body?.slugs) ? body.slugs : [])
    .filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s))
    .slice(0, 4);
  for (const s of slugs) revalidateTag(`site:${s}`, { expire: 0 });
  return NextResponse.json({ refreshed: slugs });
}
