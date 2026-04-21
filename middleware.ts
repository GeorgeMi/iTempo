import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

const PROTECTED_SEGMENTS = ["/dashboard", "/calendar", "/clients", "/services", "/reports", "/settings"];

function isProtected(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  const rest = "/" + segments.slice(1).join("/");
  return PROTECTED_SEGMENTS.some((s) => rest === s || rest.startsWith(s + "/"));
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip assets / api
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const response = intl(req);

  if (isProtected(pathname)) {
    // Auth.js v5 session cookie names (dev and prod variants)
    const sessionToken =
      req.cookies.get("authjs.session-token") ??
      req.cookies.get("__Secure-authjs.session-token");
    if (!sessionToken) {
      const locale = pathname.split("/")[1] || routing.defaultLocale;
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/signin`;
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|robots.txt).*)"],
};
