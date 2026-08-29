import type { UserRole } from "@/types";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      username?: string | null;
      email?: string | null;
      image?: string | null;
      role?: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    username?: string | null;
  }
}
