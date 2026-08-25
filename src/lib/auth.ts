import type { AuthOptions, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { findAccessByEmail } from "@/lib/repositories/access";
import type { UserRole } from "@/types";

function bootstrapAdminEmails(): string[] {
  return (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    /**
     * Gatekeeper: only emails that are bootstrap admins OR have an "active"
     * row in the Access_Control sheet may sign in. Everyone else is bounced
     * to /access-denied. This is what makes the app "share with whoever I
     * give permission to" rather than "share with anyone with a Google account".
     */
    async signIn({ user }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;
      if (bootstrapAdminEmails().includes(email)) return true;
      try {
        const access = await findAccessByEmail(email);
        return !!access && access.status === "active";
      } catch (err) {
        console.error("Access check failed during sign-in:", err);
        return false;
      }
    },
    async jwt({ token }) {
      const email = token.email?.toLowerCase().trim();
      if (!email) return token;
      if (bootstrapAdminEmails().includes(email)) {
        token.role = "admin" as UserRole;
        return token;
      }
      try {
        const access = await findAccessByEmail(email);
        token.role = (access?.status === "active" ? access.role : "viewer") as UserRole;
      } catch {
        token.role = "viewer" as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Session["user"] & { role: UserRole }).role =
          (token.role as UserRole) ?? "viewer";
      }
      return session;
    },
  },
};

export function isAdmin(session: Session | null): boolean {
  return (session?.user as { role?: UserRole } | undefined)?.role === "admin";
}

export function canEdit(session: Session | null): boolean {
  const role = (session?.user as { role?: UserRole } | undefined)?.role;
  return role === "admin" || role === "editor";
}
