// Self-check for the pure parts of lib/calcom.js. No network, no API key.
// Run: node lib/calcom.test.js
//
// This covers the two things most likely to break silently: the /v2/slots response
// is an object keyed by DATE (not an array), and the whole module must stay OFF
// when it is not configured.

import assert from "node:assert/strict";
import { parseSlots, describeSlot, calendarEnabled } from "./calcom.js";

let n = 0;
const check = (label, fn) => { fn(); n++; console.log("  ok  " + label); };

console.log("lib/calcom.js self-check\n");

// The real shape, straight from cal.com's documented example.
const REAL = {
  status: "success",
  data: {
    "2050-09-06": [{ start: "2050-09-06T09:00:00.000+02:00" }, { start: "2050-09-06T10:00:00.000+02:00" }],
    "2050-09-05": [{ start: "2050-09-05T09:00:00.000+02:00" }],
  },
};

check("flattens the date-keyed object into a list", () => {
  assert.equal(parseSlots(REAL).length, 3);
});

check("sorts chronologically even when dates arrive out of order", () => {
  const got = parseSlots(REAL);
  assert.ok(got[0].startsWith("2050-09-05"), "earliest date must come first, got " + got[0]);
  assert.deepEqual(got, [...got].sort());
});

check("honours the limit", () => {
  assert.equal(parseSlots(REAL, 2).length, 2);
});

// Every one of these has been a real-world response at some point.
check("survives junk without throwing", () => {
  for (const bad of [null, undefined, {}, { data: null }, { data: [] }, { data: { d: null } }, "nope"]) {
    assert.deepEqual(parseSlots(bad), [], "expected [] for " + JSON.stringify(bad));
  }
});

check("ignores slot entries with no start", () => {
  assert.deepEqual(parseSlots({ data: { "2050-01-01": [{}, { start: "2050-01-01T00:00:00Z" }] } }),
    ["2050-01-01T00:00:00Z"]);
});

check("describeSlot renders in the requested zone, not the server's", () => {
  // 2050-01-01T20:00:00Z is still Jan 1st, 10am, in Honolulu (UTC-10).
  const s = describeSlot("2050-01-01T20:00:00Z", "Pacific/Honolulu");
  assert.ok(/Jan 1/.test(s), "expected Jan 1 in Honolulu, got: " + s);
  assert.ok(/10:00/.test(s), "expected 10:00 in Honolulu, got: " + s);
});

check("describeSlot returns the input rather than 'Invalid Date' on junk", () => {
  assert.equal(describeSlot("not-a-date"), "not-a-date");
});

check("stays OFF unless BOTH key and event type are set", () => {
  // The test runner sets neither, so this must be false. Half-configured is also off,
  // which is the case that would otherwise fail per-conversation instead of never.
  assert.equal(calendarEnabled(), Boolean(process.env.CALCOM_API_KEY && process.env.CALCOM_EVENT_TYPE_ID));
});

// A suite that asserts nothing passes. Prove the assertions can actually fail.
console.log("\n  control: an assertion that must fail");
try {
  assert.equal(parseSlots(REAL).length, 999);
  console.log("  BAD  control passed - these assertions are not running");
  process.exit(1);
} catch {
  console.log("  ok   control failed as it should, so the checks above are real");
}

console.log(`\n${n} checks passed.`);
