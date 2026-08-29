import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserAuthByEmail, getUserAuthByUsername } from "@/lib/repositories/users";
import type { UserRole } from "@/types";

/**
 * Milestone 2: real per-person accounts, backed by the `users` table
 * (src/lib/repositories/users.ts) — sign up at /register, an admin
 * approves and assigns a role from the /admin panel, then sign in with
 * email (or, if they've set one, their username) + password.
 *
 * The single "identifier" field accepts either — an "@" in it means treat
 * it as an email, anything else means treat it as a username. Username is
 * optional per account (set at registration or later from My Account), so
 * this never breaks anyone signing in with just their email as before.
 *
 * The original Milestone 1 shared password(s) (APP_ACCESS_PASSWORD /
 * APP_VIEWER_PASSWORD) still work as a deliberate bootstrap/recovery path:
 * leave the identifier field blank at /login. This is what lets the person
 * who deploys this app get in and approve the very first real account
 * without a chicken-and-egg problem, and stays as an emergency door if the
 * users table is ever unreachable. APP_ACCESS_PASSWORD now grants the
 * "admin" role (user management included), not just "editor".
 */
export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: {
        email: { label: "Email or Username (leave blank for the shared access password)", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.email ?? "").trim();
        const password = credentials?.password ?? "";
        if (!password) return null;

        if (!identifier) {
          const editorPassword = process.env.APP_ACCESS_PASSWORD;
          const viewerPassword = process.env.APP_VIEWER_PASSWORD;
          if (!editorPassword) {
            throw new Error("APP_ACCESS_PASSWORD is not configured on the server. See docs/DEPLOYMENT.md.");
          }
          if (password === editorPassword) {
            // APP_ACCESS_NAME is optional — lets whoever uses this shared login
            // see a name they picked (e.g. "Rishi") in the sidebar instead of
            // the generic default. Purely cosmetic, no effect on access.
            return {
              id: "bootstrap-admin",
              name: process.env.APP_ACCESS_NAME || "Full access (shared password)",
              role: "admin" as UserRole,
            };
          }
          if (viewerPassword && password === viewerPassword) {
            return {
              id: "bootstrap-viewer",
              name: process.env.APP_VIEWER_NAME || "View only (shared password)",
              role: "viewer" as UserRole,
            };
          }
          return null;
        }

        const user = identifier.includes("@")
          ? await getUserAuthByEmail(identifier)
          : await getUserAuthByUsername(identifier);
        if (!user || user.status !== "approved") return null;
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          name: user.name || user.email,
          username: user.username || null,
          email: user.email,
          role: user.role,
        };
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
        token.username = (user as unknown as { username?: string | null }).username ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role as UserRole;
        session.user.name = token.name;
        session.user.username = token.username ?? null;
      }
      return session;
    },
  },
};
