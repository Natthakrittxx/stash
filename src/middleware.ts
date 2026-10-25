import { type NextRequest, NextResponse } from "next/server";

// better-auth's session cookie; production (https) sets the __Secure- form.
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

// Logged-in users fork straight to their stash. A cookie check only, no DB: a
// stale cookie lands on /stash, whose real session check sends it to /login.
// Read directly rather than via better-auth/cookies, which drags jose (~35 kB
// and Edge-incompatible warnings) into the middleware for one lookup.
export function middleware(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    return NextResponse.redirect(new URL("/stash", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
