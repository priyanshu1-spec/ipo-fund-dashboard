import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createUser } from "@/lib/repositories/users";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Public — anyone can request an account. It's created with status "pending" and grants no access until an admin approves it in /admin. */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await createUser({
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
    });
    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, status: user.status } },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 400 }
    );
  }
}
