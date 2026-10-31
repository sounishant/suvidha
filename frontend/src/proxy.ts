import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// A quick cookie check only; the backend decides whether the session is still live (lib/session.ts).
export function proxy(req: NextRequest) {
  if (!req.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/account/:path*"] };
