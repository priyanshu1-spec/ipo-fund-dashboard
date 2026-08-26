import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { UserRole } from "@/types";

/**
 * Milestone 1: access is still a shared password (APP_ACCESS_PASSWORD for
 * full access, optional APP_VIEWER_PASSWORD for read-only) — not yet backed
 * by individual database accounts. Real per-person registration/approval
 * (Milestone 2) will replace this with DB-backed users and roles; the IPO
 * data and your personal Applications/Funds/Investors records are already
 * on the server (see src/lib/db.ts) regardless of this milestone's simpler
 * auth. To revoke access for everyone right now, change the password(s) in
 * your hosting provider's env vars and redeploy.
 */
export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const password = credentials?.password ?? "";
        const editorPassword = process.env.APP_ACCESS_PASSWORD;
        const viewerPassword = process.env.APP_VIEWER_PASSWORD;

        if (!editorPassword) {
          throw new Error("APP_ACCESS_PASSWORD is not configured on the server. See docs/DEPLOYMENT.md.");
        }
        if (password && password === editorPassword) {
          return { id: "editor", name: "Full access", role: "editor" as UserRole };
        }
        if (viewerPassword && password && password === viewerPassword) {
          return { id: "viewer", name: "View only", role: "viewer" as UserRole };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: UserRole }).role;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as UserRole;
        session.user.name = token.name;
      }
      return session;
    },
  },
};

export function canEdit(role: UserRole | undefined): boolean {
  return role === "editor";
}
