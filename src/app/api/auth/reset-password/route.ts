import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  clearUserResetOtp,
  getUserResetAuthByEmail,
  incrementResetOtpAttempts,
  setUserPasswordHash,
} from "@/lib/repositories/users";

const MAX_ATTEMPTS = 5;

const schema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{4}$/, "Enter the 4-digit code"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Step 2 of "forgot password": verify the code and set a new password.
 * A wrong email/code always gets the same generic error — same
 * no-enumeration reasoning as forgot-password/route.ts — so this can't be
 * used to probe which emails exist or narrow down a code by the error
 * message differing.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const genericError = NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });

  const user = await getUserResetAuthByEmail(parsed.data.email);
  if (!user || !user.resetOtpHash) return genericError;

  if (!user.resetOtpExpiresAt || new Date(user.resetOtpExpiresAt).getTime() < Date.now()) {
    await clearUserResetOtp(user.id);
    return genericError;
  }

  if (user.resetOtpAttempts >= MAX_ATTEMPTS) {
    await clearUserResetOtp(user.id);
    return NextResponse.json(
      { error: "Too many incorrect attempts. Request a new code." },
      { status: 400 }
    );
  }

  const valid = await bcrypt.compare(parsed.data.otp, user.resetOtpHash);
  if (!valid) {
    const attempts = await incrementResetOtpAttempts(user.id);
    if (attempts >= MAX_ATTEMPTS) {
      await clearUserResetOtp(user.id);
      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new code." },
        { status: 400 }
      );
    }
    return genericError;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await setUserPasswordHash(user.id, passwordHash);
  await clearUserResetOtp(user.id);

  return NextResponse.json({ ok: true });
}
