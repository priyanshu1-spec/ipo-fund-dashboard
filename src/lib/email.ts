// ============================================================================
// Transactional email — used only for the forgot-password OTP. Sends via
// Resend's REST API directly with `fetch()` (no SDK dependency, same
// approach as every other external integration in this app) rather than
// picking an email library, since a plain HTTPS POST is all sending one
// email needs.
//
// Why Resend specifically: a free tier (100 emails/day, 3,000/month at the
// time of writing) generous enough for a personal app's password resets,
// and it can send from its own onboarding@resend.dev address with zero
// domain setup — good enough to get this working immediately, upgradeable
// to a custom "from" address later (Vercel → Resend → verify a domain)
// without any code change, just an env var.
//
// HONEST CAVEAT, same as every other integration in this app: the request/
// response shape below is from general knowledge of Resend's API, not
// independently verified live — this sandbox can't reach api.resend.com
// either. Defensive error handling captures the raw response on failure,
// so a wrong assumption is diagnosable from one real attempt.
//
// Requires RESEND_API_KEY (see docs/DEPLOYMENT.md). Without it, sendEmail()
// returns a clear "not configured" error instead of silently doing
// nothing — the forgot-password route surfaces that as a real error
// rather than pretending an email went out.
// ============================================================================

export type SendEmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(to: string, subject: string, text: string): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured on the server. See docs/DEPLOYMENT.md." };
  }
  const from = process.env.RESEND_FROM_EMAIL || "IPO Fund Dashboard <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Email send failed (HTTP ${res.status}): ${body.slice(0, 300) || "(empty)"}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Email send failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
