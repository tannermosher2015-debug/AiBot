// Cal.com booking - the difference between "here's a link" and an actual reservation.
//
// OFF BY DEFAULT. Without CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID the bot keeps its
// old, honest behaviour: capture the lead, hand over BOOKING_URL, promise nothing.
// Turning this on is what makes the sales claim "books appointments" true.
//
// Environment:
//   CALCOM_API_KEY        - Cal.com API key (Settings -> Developer -> API keys)
//   CALCOM_EVENT_TYPE_ID  - numeric id of the event type to book into
//   CALCOM_TIMEZONE       - IANA zone for slots and bookings (default Pacific/Honolulu)
//
// TWO DIFFERENT VERSION HEADERS, and this is not a typo. Cal.com versions per
// endpoint: slots want 2024-09-04, bookings want 2026-02-25. Sending the wrong one
// does not error loudly, it silently serves an older shape. Both values were read
// from cal.com's own API reference on 2026-08-26.

const BASE = "https://api.cal.com";
const API_KEY = process.env.CALCOM_API_KEY;
const EVENT_TYPE_ID = process.env.CALCOM_EVENT_TYPE_ID;
const TZ = process.env.CALCOM_TIMEZONE || "Pacific/Honolulu";

const SLOTS_VERSION = "2024-09-04";
const BOOKINGS_VERSION = "2026-02-25";

// One switch, checked everywhere. Half-configured counts as off: booking with a key
// but no event type would fail per-conversation instead of never being offered.
export function calendarEnabled() {
  return Boolean(API_KEY && EVENT_TYPE_ID);
}

export function bookingTimeZone() {
  return TZ;
}

// Turn the /v2/slots response into a flat, sorted list of ISO start times.
// Exported so it can be tested without touching the network. The response is an
// object keyed by date, NOT an array, which is the shape most people get wrong.
export function parseSlots(payload, limit = 6) {
  const byDate = payload && payload.data;
  if (!byDate || typeof byDate !== "object") return [];
  const out = [];
  for (const day of Object.keys(byDate).sort()) {
    const slots = byDate[day];
    if (!Array.isArray(slots)) continue;
    for (const s of slots) {
      if (s && typeof s.start === "string") out.push(s.start);
    }
  }
  out.sort();
  return out.slice(0, limit);
}

// Human-readable slot label in the booking timezone, e.g. "Thursday, Aug 28 at 10:00 AM".
export function describeSlot(iso, timeZone = TZ) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Real open slots for the next `days` days. Returns [] on any failure: a booking
// path that throws would strand the conversation, and an empty list already means
// "offer the link instead", which is the correct fallback either way.
export async function fetchAvailableSlots({ days = 7, limit = 6 } = {}) {
  if (!calendarEnabled()) return [];
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    eventTypeId: String(EVENT_TYPE_ID),
    start: now.toISOString(),
    end: end.toISOString(),
    timeZone: TZ,
  });
  try {
    const res = await fetch(`${BASE}/v2/slots?${qs}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "cal-api-version": SLOTS_VERSION,
      },
    });
    if (!res.ok) {
      console.error("[calcom] slots responded", res.status, await res.text().catch(() => ""));
      return [];
    }
    return parseSlots(await res.json(), limit);
  } catch (err) {
    console.error("[calcom] slots request failed:", err.message);
    return [];
  }
}

// Create a real booking. Returns { booked: true, start } or { booked: false, reason }.
// NEVER throws: the caller turns a false into "use the link instead", and a thrown
// error here would break the chat turn entirely.
export async function createBooking({ start, name, email, phone, notes }) {
  if (!calendarEnabled()) return { booked: false, reason: "calendar_disabled" };
  if (!start) return { booked: false, reason: "no_start" };
  // Cal.com identifies an attendee by email. A phone-only lead cannot be booked,
  // and saying so is better than sending a booking that quietly has no attendee.
  if (!email || !email.includes("@")) return { booked: false, reason: "email_required" };

  const body = {
    start: new Date(start).toISOString(),
    eventTypeId: Number(EVENT_TYPE_ID),
    attendee: { name: name || "Website lead", email, timeZone: TZ },
  };
  if (phone) body.attendee.phoneNumber = phone;
  if (notes) body.metadata = { notes: String(notes).slice(0, 500) };

  try {
    const res = await fetch(`${BASE}/v2/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "cal-api-version": BOOKINGS_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[calcom] booking responded", res.status, detail);
      return { booked: false, reason: `calcom_${res.status}` };
    }
    return { booked: true, start: body.start };
  } catch (err) {
    console.error("[calcom] booking request failed:", err.message);
    return { booked: false, reason: "exception" };
  }
}
