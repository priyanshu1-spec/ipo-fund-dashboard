import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getUserSecurityAuthByEmail, setUserPasswordHash } from "@/lib/repositories/users";

const schema = z.object({
  email: z.string().email(),
  answer: z.string().min(1, "Enter your answer"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// Answers are matched case/whitespace-insensitively ("Fluffy" == "fluffy ")
// — a security question's whole point is being easy for the real owner to
// answer consistently; exact-match would just make people re-guess their
// own answer's capitalization.
function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

/**
 * Step 2: verify the answer and set a new password. KNOWN, ACCEPTED GAP:
 * unlike the OTP approach this replaced, there's no attempt limit or
 * expiry here — a security question doesn't have a natural "expires"
 * concept, and per-account lockout would need its own storage this app
 * doesn't have a reason to add yet for a small private deployment. This
 * is exactly the tradeoff described when security questions were chosen
 * over an emailed code: fine for this app's actual threat model, worth
 * revisiting if that ever changes.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const genericError = NextResponse.json({ error: "Incorrect answer." }, { status: 400 });

  const user = await getUserSecurityAuthByEmail(parsed.data.email);
  if (!user || !user.securityAnswerHash) return genericError;

  const valid = await bcrypt.compare(normalizeAnswer(parsed.data.answer), user.securityAnswerHash);
  if (!valid) return genericError;

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await setUserPasswordHash(user.id, passwordHash);

  return NextResponse.json({ ok: true });
}
