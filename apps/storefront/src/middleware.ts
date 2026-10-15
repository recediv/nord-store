import { NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  if (!request.cookies.get("_medusa_cache_id")?.value) {
    response.cookies.set("_medusa_cache_id", crypto.randomUUID(), {
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    })
  }
  return response
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
}
