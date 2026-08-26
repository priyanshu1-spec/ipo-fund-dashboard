import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protect every page except the login/register screens, all API routes
  // (each one enforces auth itself via requireApiAuth so it can return
  // clean 401/403 JSON instead of an HTML redirect), and static assets.
  matcher: ["/((?!login|register|api|_next/static|_next/image|favicon.ico).*)"],
};
