// Lead delivery — the part that makes this a real tool, not a demo.
// When the bot captures/books a lead, this emails the agent instantly (via
// Resend) and surfaces a real booking link. It degrades gracefully: if the
// env isn't set, it logs the lead so nothing is ever lost.
//
// Configured via environment variables:
//   RESEND_API_KEY    — your Resend API key (required to actually send email)
//   LEAD_NOTIFY_EMAIL — where leads are sent (required to actually send email)
//   LEAD_FROM_EMAIL   — verified sender (default: leads@frontlinewebdesign.tech)
//   BOOKING_URL       — your Cal.com/Calendly link the bot offers for a real time

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY = process.env.LEAD_NOTIFY_EMAIL;
const FROM = process.env.LEAD_FROM_EMAIL || "leads@frontlinewebdesign.tech";
const BOOKING_URL = process.env.BOOKING_URL || "";

// The real booking link the bot can hand a lead so they lock an actual time.
export function bookingLink() {
  return BOOKING_URL;
}

// Email the agent the moment a lead is captured. Never throws — a failed email
// must not break the conversation; the lead is always logged as a fallback.
export async function deliverLead({ brand, kind, input }) {
  const safe = input && typeof input === "object" ? input : {};
  const rows = Object.entries(safe)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  const who = safe.name || "New lead";
  const biz = safe.business ? ` (${safe.business})` : "";
  const subject = `New ${kind} — ${who}${biz}`;
  const text = `A new lead came in through the ${brand} assistant:\n\n${rows}\n`;

  // Always log first, so a lead is never lost even if the email fails.
  console.log(`\nLEAD CAPTURED — ${subject}\n${rows}\n`);

  if (!RESEND_API_KEY || !NOTIFY) {
    console.warn("[leads] RESEND_API_KEY / LEAD_NOTIFY_EMAIL not set — logged only, no email sent.");
    return { emailed: false, reason: "unconfigured" };
  }

  try {
    const body = { from: FROM, to: NOTIFY, subject, text };
    const contact = safe.contact ? String(safe.contact) : "";
    if (contact.includes("@")) body.reply_to = contact;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[leads] Resend responded", res.status, detail);
      return { emailed: false, reason: `resend_${res.status}` };
    }
    return { emailed: true };
  } catch (err) {
    console.error("[leads] email send failed:", err.message);
    return { emailed: false, reason: "exception" };
  }
}
