// ============================================================================
// Transactional email — currently used only to notify an admin when a new
// account requests approval. Sends via Resend's REST API directly with
// `fetch()` (no SDK dependency, same approach as every other external
// integration in this app) rather than picking an email library, since a
// plain HTTPS POST is all sending one email needs.
//
// Why Resend specifically: a free tier (100 emails/day, 3,000/month at the
// time of writing) generous enough for a personal app's signup alerts,
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
// Deliberately best-effort: nothing that sends an email here should ever
// be allowed to break the action that triggered it (e.g. a signup must
// still succeed even if the admin-notification email fails to send) —
// callers catch and log, never let this throw uncaught.
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
