import { NextRequest, NextResponse } from "next/server";

function parseBasicAuth(authorization: string | null): { username: string; password: string } | null {
  if (!authorization || !authorization.startsWith("Basic ")) return null;

  try {
    const decoded = atob(authorization.slice(6));
    const [username, password] = decoded.split(":");
    if (!username || password === undefined) return null;
    return { username, password };
  } catch {
    return null;
  }
}

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="WoW Tier Admin"'
    }
  });
}

function checkAdminBasicAuth(request: NextRequest): boolean {
  const auth = parseBasicAuth(request.headers.get("authorization"));
  if (!auth) return false;

  return auth.username === process.env.ADMIN_USERNAME && auth.password === process.env.ADMIN_PASSWORD;
}

function checkCronSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");
  return Boolean(secret && secret === process.env.CRON_SECRET);
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    if (!checkAdminBasicAuth(request)) {
      return unauthorized();
    }
  }

  if (path.startsWith("/api/cron/refresh")) {
    if (!checkCronSecret(request)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  if (path === "/api/refresh") {
    const isAdmin = checkAdminBasicAuth(request);
    const isCron = checkCronSecret(request);
    if (!isAdmin && !isCron) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/cron/refresh", "/api/refresh"]
};
