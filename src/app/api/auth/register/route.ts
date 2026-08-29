import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createUser, setUserSecurityQuestion } from "@/lib/repositories/users";

const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    // Optional alternate login handle — letters/digits/underscore only, so it
    // can never look like an email (which is how auth.ts tells the two apart
    // at sign-in) and never collides with special characters in URLs, etc.
    username: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,30}$/, "Username must be 3-30 letters, numbers, or underscores")
      .optional()
      .or(z.literal("")),
    // Optional at signup (skippable — set later from My Account) but if
    // either half is filled in, both must be, so no account ends up with a
    // question and no answer or vice versa.
    securityQuestion: z.string().trim().max(200).optional().or(z.literal("")),
    securityAnswer: z.string().trim().max(200).optional().or(z.literal("")),
  })
  .refine((data) => !!data.securityQuestion === !!data.securityAnswer, {
    message: "Enter both a security question and an answer, or leave both blank",
    path: ["securityAnswer"],
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
      username: parsed.data.username,
    });
    if (parsed.data.securityQuestion && parsed.data.securityAnswer) {
      const answerHash = await bcrypt.hash(parsed.data.securityAnswer.trim().toLowerCase(), 10);
      await setUserSecurityQuestion(user.id, parsed.data.securityQuestion, answerHash);
    }
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
