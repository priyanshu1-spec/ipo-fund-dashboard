import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { findUserByUsername } from "@/lib/repositories/users";
import { verifyPassword } from "@/lib/password";
import type { UserRole } from "@/types";

/**
 * Per-person accounts, stored in the app's own database (no external
 * identity provider). BOOTSTRAP_ADMIN_USERNAME / BOOTSTRAP_ADMIN_PASSWORD
 * always work regardless of what's in the database — that's what guarantees
 * the owner can never be locked out, and is how you log in the very first
 * time (before any users exist) to then create real accounts under
 * Settings -> Manage Users.
 */
export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim() ?? "";
        const password = credentials?.password ?? "";
        if (!username || !password) return null;

        const bootstrapUser = process.env.BOOTSTRAP_ADMIN_USERNAME;
        const bootstrapPass = process.env.BOOTSTRAP_ADMIN_PASSWORD;
        if (bootstrapUser && bootstrapPass && username === bootstrapUser && password === bootstrapPass) {
          return { id: "bootstrap-admin", name: username, role: "editor" as UserRole };
        }

        const user = await findUserByUsername(username);
        if (!user || user.status !== "active") return null;
        if (!verifyPassword(password, user.passwordHash)) return null;

        return { id: user.id, name: user.username, role: user.role };
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
