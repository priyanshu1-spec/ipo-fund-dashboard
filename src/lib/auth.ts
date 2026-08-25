import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { UserRole } from "@/types";

/**
 * There is no backend database, so access is a shared password rather than
 * individual accounts: APP_ACCESS_PASSWORD (required) grants full access,
 * APP_VIEWER_PASSWORD (optional) grants read-only access. To revoke access
 * for everyone, change the password(s) in your hosting provider's env vars
 * and redeploy.
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
