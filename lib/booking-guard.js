// The last line of defence against the bot telling someone they have an
// appointment they do not have.
//
// Deliberately its own module with NO dependencies, so lib/booking-guard.test.js
// runs without installing the Anthropic SDK. A correctness check that needs a
// vendor package and a network is a check that stops being run.

// Phrases that tell a customer they HAVE an appointment. The system prompt already
// forbids these, and measurably that is not enough: across two identical replays the
// model said "all set" in one run and not the other. A prompt is a nudge; this is the
// guarantee. Cheap insurance against the worst failure this bot has, which is a lead
// who believes a time is held, does not show, and blames the product.
const BOOKING_CLAIM_PATTERNS = [
  /\block(?:ed)? in\b/i,
  /\ball set\b/i,
  /\byou'?re (?:booked|scheduled|confirmed|good to go)\b/i,
  /\bi'?(?:ve| have) (?:booked|scheduled|reserved)\b/i,
  /\bconfirmed for\b/i,
  /\byou'?re (?:on|in) (?:the|my|our) (?:calendar|books|schedule)\b/i,
  /\bsee you (?:on |this )?(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i,
];

// Appends a correction rather than rewriting the sentence. Surgical word-swapping
// mangles grammar: "Locked in for Thursday at 10am" has no honest in-place
// replacement that still reads. A trailing clarification is always grammatical, and
// the last line is the one a reader acts on.
export function guardBookingClaims(reply, { booked = false, bookingUrl = "" } = {}) {
  if (booked) return reply;                    // it really is reserved; let it say so
  if (typeof reply !== "string" || !reply) return reply;
  if (!BOOKING_CLAIM_PATTERNS.some((re) => re.test(reply))) return reply;
  if (/nothing (?:is |'s )?reserved/i.test(reply)) return reply; // already honest
  console.warn("[guard] rewrote a false booking claim:", reply.slice(0, 120));
  return reply + "\n\nJust to be clear: nothing is reserved yet."
    + (bookingUrl ? " Pick a time here: " + bookingUrl : "");
}
