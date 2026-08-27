// Self-check for lib/booking-guard.js. No deps, no network, no API key.
// Run: node lib/booking-guard.test.js
//
// The fixtures marked REAL are verbatim from a live conversation on 2026-08-26,
// where the bot told a landscaping business owner he had a Thursday 10am slot.
// Nothing was booked. If this file ever goes red, that is back.

import assert from "node:assert/strict";
import { guardBookingClaims } from "./booking-guard.js";

const LINK = "https://cal.com/tanner-mosher-5epe2o";
const opts = (booked = false) => ({ booked, bookingUrl: LINK });
const guarded = (s) => guardBookingClaims(s, opts(false)).includes("nothing is reserved yet");

let n = 0;
const check = (label, fn) => { fn(); n++; console.log("  ok  " + label); };

console.log("lib/booking-guard.js self-check\n");

// ---- REAL lines that must be caught -------------------------------------
const REAL_LIES = [
  "Locked in for Thursday at 10am - here's the link to confirm the slot: " + LINK,
  "You're all set for Thursday at 10am. See you Thursday, Tanner.",
  "You're all set, Tanner - here's the booking link to grab a free 15-minute slot.",
];

for (const line of REAL_LIES) {
  check(`catches a real one: "${line.slice(0, 44)}..."`, () => {
    assert.ok(guarded(line), "this claim escaped the guard");
  });
}

check("catches the other phrasings the model reaches for", () => {
  for (const s of [
    "Great, I've booked you in for Tuesday.",
    "You're scheduled for the 3rd.",
    "You're confirmed for tomorrow afternoon.",
    "You're on the calendar.",
    "Confirmed for Friday at 2pm.",
    "See you Thursday!",
    "I have reserved that time for you.",
  ]) {
    assert.ok(guarded(s), "escaped the guard: " + s);
  }
});

// REAL, 2026-08-26: the bot's opening line before anything was booked. The first
// version of the guard missed this on the single word "that".
check("catches a claim with words between 'lock' and 'in'", () => {
  for (const s of [
    "Great - happy to lock that in. First, what's your name and email?",
    "Let me lock it in for you.",
    "I'll lock the details in now.",
    "I've penciled you in for Thursday.",
    "Got you down for 10am.",
    "I've saved your slot.",
    "Holding that time for you.",
  ]) {
    assert.ok(guarded(s), "escaped the guard: " + s);
  }
});

check("the wider pattern does not fire on ordinary sentences", () => {
  for (const s of [
    "You can log in to your dashboard any time.",
    "We block spam before it reaches your inbox.",
    "I'll look into that and get back to you.",
    "That's included in the monthly price.",
  ]) {
    assert.equal(guardBookingClaims(s, opts(false)), s, "false positive on: " + s);
  }
});

check("appends the real booking link so the correction is actionable", () => {
  assert.ok(guardBookingClaims(REAL_LIES[0], opts(false)).includes(LINK));
});

check("works with no link configured, without printing undefined", () => {
  const out = guardBookingClaims("You're all set.", { booked: false, bookingUrl: "" });
  assert.ok(out.includes("nothing is reserved yet"));
  assert.ok(!/undefined|null/.test(out), "leaked a placeholder: " + out);
});

// ---- must NOT fire ------------------------------------------------------
check("stays silent when the booking is REAL", () => {
  const out = guardBookingClaims("You're all set for Thursday at 10am.", opts(true));
  assert.ok(!out.includes("nothing is reserved yet"), "corrected a booking that genuinely happened");
});

check("stays silent on honest replies", () => {
  for (const s of [
    "Nothing's reserved yet - grab a time that suits you here: " + LINK,
    "What's the best email to reach you at?",
    "We install a 24/7 assistant on your site for $300 setup and $75 a month.",
    "I can't see the calendar, so here's the link to pick a time yourself.",
  ]) {
    assert.equal(guardBookingClaims(s, opts(false)), s, "fired on an honest reply: " + s);
  }
});

check("does not double-append when the reply already says it", () => {
  const s = "You're all set to pick a time - nothing is reserved yet.";
  assert.equal(guardBookingClaims(s, opts(false)), s);
});

check("survives junk input without throwing", () => {
  for (const bad of [null, undefined, "", 42, {}]) {
    assert.doesNotThrow(() => guardBookingClaims(bad, opts(false)));
  }
});

// A guard that never fires would pass every "stays silent" test above.
console.log("\n  control: the guard must actually be capable of firing");
const fired = guardBookingClaims("Locked in for Thursday.", opts(false));
if (fired === "Locked in for Thursday.") {
  console.log("  BAD  the guard changed nothing - it is inert");
  process.exit(1);
}
console.log("  ok   it fires, so the silent cases above mean something");

console.log(`\n${n} checks passed.`);
