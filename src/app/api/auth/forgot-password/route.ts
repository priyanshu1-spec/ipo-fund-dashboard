import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getUserResetAuthByEmail, setUserResetOtp } from "@/lib/repositories/users";
import { sendEmail } from "@/lib/email";

/** Same reasoning as api/admin/ipo/refresh — the outbound request (to Resend) has its own timeout, but this guarantees Vercel kills the function well before that could hang the whole request. */
export const maxDuration = 30;

const OTP_TTL_MINUTES = 10;

const schema = z.object({ email: z.string().email() });

/**
 * Step 1 of "forgot password": request a code. Public — anyone can call
 * this with any email, which is exactly why the response is identical
 * whether or not that email has an account: returning a different message
 * for "no such account" vs "code sent" would let this endpoint be used to
 * enumerate who has an account here, an information leak this app
 * otherwise avoids (see the RBAC work's per-user data isolation).
 */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const genericResponse = NextResponse.json({
    ok: true,
    message: "If that email has an account, a code has been sent.",
  });

  const user = await getUserResetAuthByEmail(parsed.data.email);
  if (!user || user.status !== "approved") {
    return genericResponse;
  }

  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  await setUserResetOtp(user.id, otpHash, expiresAt);

  const result = await sendEmail(
    user.email,
    "Your IPO Fund Dashboard password reset code",
    `Your password reset code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.\n\n` +
      `If you didn't request this, you can ignore this email — your password hasn't changed.`
  );

  if (!result.ok) {
    // A genuinely broken mail setup (missing/bad RESEND_API_KEY, etc.) is
    // the one case worth surfacing for real — silently pretending success
    // when no email could ever have gone out would leave the admin
    // debugging a "reset never arrives" report with zero information.
    // A wrong/nonexistent email address itself still gets the generic
    // response above; this only fires once we already know the account
    // exists and the send itself failed.
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return genericResponse;
}
