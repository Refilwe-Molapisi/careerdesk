import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/data/supabase/proxy";

/**
 * Next.js 16 proxy (the renamed middleware). Runs before every request:
 * refreshes the Supabase session and enforces login for all private pages.
 * Static assets are excluded via the matcher below.
 */
const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.has(pathname);

  const { supabaseResponse, user } = await updateSession(request);

  if (!user && !isPublic) {
    // API routes get a JSON 401 instead of an HTML redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Not signed in." },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and PWA files:
     * - _next/static, _next/image (build output and optimised images)
     * - favicon, icons, manifest, service worker, robots
     * - common static file extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|icons/|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)",
  ],
};
