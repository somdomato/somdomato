import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "session-id";

function getSessionFromCookie(
  cookies: NextRequest["cookies"],
): { id: string; role: string } | null {
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    // atob é compatível com Edge Runtime
    const decoded = atob(raw);
    const parsed = JSON.parse(decoded);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      (parsed.role === "user" || parsed.role === "admin")
    ) {
      return parsed as { id: string; role: string };
    }
    return null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permite acesso à página de login
  if (pathname === "/admin/login") return NextResponse.next();

  const session = getSessionFromCookie(request.cookies);

  if (!session || session.role !== "admin") {
    // API routes retornam 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    // Pages redirecionam para login
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
