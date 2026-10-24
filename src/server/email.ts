import { env } from "~/env";

/** Plain-text mail via Resend's REST API. No key (local dev): print it instead. */
export async function sendEmail(to: string, subject: string, text: string) {
  if (!env.RESEND_API_KEY) {
    console.log(`\n✉ ${to} — ${subject}\n${text}\n`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
