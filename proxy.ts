import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const session = req.auth
  const user = session?.user as unknown as { role?: string; isActive?: boolean } | undefined

  // Захист /admin — тільки ADMIN, інакше редирект на сторінку помилки (не HTML 500)
  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      // 401 — не авторизований
      return NextResponse.redirect(new URL("/unauthorized", req.nextUrl))
    }
    if (user?.role !== "ADMIN" || user?.isActive === false) {
      // 403 — недостатньо прав
      return NextResponse.redirect(new URL("/forbidden", req.nextUrl))
    }
  }

  // /profile — будь-який авторизований
  if (pathname.startsWith("/profile") && !session?.user) {
    return NextResponse.redirect(new URL("/unauthorized", req.nextUrl))
  }

  return NextResponse.next()
})

// Best practice: матчимо тільки захищені маршрути — /api/auth/* НЕ матчимо,
// інакше proxy зламає Auth.js (ClientFetchError з HTML)
export const config = {
  matcher: ["/admin/:path*", "/profile"],
}
