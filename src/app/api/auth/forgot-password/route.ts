import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserSecurityQuestionByEmail } from "@/lib/repositories/users";

const schema = z.object({ email: z.string().email() });

/**
 * Step 1 of "forgot password": look up the security question for an
 * email. This is the one unavoidable trade-off of a security-question
 * reset done without email: to let the real account owner answer, the
 * question itself has to be shown to whoever asks — there's no way to
 * gate that behind proving identity first, since answering the question
 * *is* the identity proof. That means this endpoint does reveal whether
 * an email has an account with a question set (via found vs. not found),
 * unlike the admin/email-OTP paths elsewhere in this app which are
 * designed not to leak that. Accepted deliberately for a small private
 * app — if that tradeoff ever stops being acceptable, an emailed code
 * (see git history) doesn't have this property, at the cost of needing an
 * email provider configured.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const found = await getUserSecurityQuestionByEmail(parsed.data.email);
  if (!found) {
    return NextResponse.json(
      { error: "No security question is set up for that email. Ask your admin to reset your password instead." },
      { status: 404 }
    );
  }

  return NextResponse.json({ question: found.question });
}
