// Self-check for the calendar on/off branch in lib/agents.js.
// Run: node lib/agents.test.js
//
// Why this exists: the bot must never describe a capability it does not have.
// Before Cal.com was wired in, every prompt promised booking while the code had
// no calendar at all, and real leads were told "Locked in for Thursday at 10am".
// This asserts the prompt and the tool list both follow the actual configuration.
//
// It runs each case in a CHILD process on purpose. calendarEnabled() reads the
// env when the module first loads, and an ES module is cached after that, so
// both branches cannot be tested in one process.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENTS = path.join(HERE, "agents.js");
const KEYS = ["dayna", "frontline", "frontline-smb"];

const PROBE = `
import { getAgent } from ${JSON.stringify("file:///" + AGENTS.replace(/\\/g, "/"))};
const out = {};
for (const k of ${JSON.stringify(KEYS)}) {
  const a = getAgent(k);
  out[k] = {
    tools: a.tools.map((t) => t.name),
    on: a.systemPrompt.includes("you CAN reserve a real time"),
    off: a.systemPrompt.includes("You CANNOT see anyone's calendar"),
    bogus: a.systemPrompt.includes("zzz-not-a-real-rule"),
  };
}
console.log(JSON.stringify(out));
`;

function probe(calendarOn) {
  const env = { ...process.env };
  delete env.CALCOM_API_KEY;
  delete env.CALCOM_EVENT_TYPE_ID;
  if (calendarOn) {
    env.CALCOM_API_KEY = "cal_test_dummy";
    env.CALCOM_EVENT_TYPE_ID = "12345";
  }
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", PROBE], { env }).toString());
}

let n = 0;
const check = (label, fn) => { fn(); n++; console.log("  ok  " + label); };

console.log("lib/agents.js calendar-branch self-check\n");

const off = probe(false);
const on = probe(true);

for (const k of KEYS) {
  check(`${k}: calendar OFF says it CANNOT book, and only that`, () => {
    assert.equal(off[k].off, true, "the cannot-book rules must be present");
    assert.equal(off[k].on, false, "must not claim it can reserve");
  });

  check(`${k}: calendar OFF offers no availability tool`, () => {
    assert.ok(!off[k].tools.includes("check_availability"),
      "a tool it cannot honour must not be offered: " + off[k].tools.join(", "));
  });

  check(`${k}: calendar ON says it CAN book, and only that`, () => {
    assert.equal(on[k].on, true, "the can-book rules must be present");
    assert.equal(on[k].off, false, "the cannot-book rules must be gone");
  });

  check(`${k}: calendar ON offers check_availability`, () => {
    assert.ok(on[k].tools.includes("check_availability"),
      "expected check_availability, got: " + on[k].tools.join(", "));
  });
}

// The .includes() checks above would ALL pass silently if the probe returned
// nonsense, so prove a string that is in neither block reads false.
check("control: a string in neither ruleset is absent", () => {
  for (const k of KEYS) {
    assert.equal(off[k].bogus, false);
    assert.equal(on[k].bogus, false);
  }
});

check("control: the two branches actually differ", () => {
  assert.notDeepEqual(off["frontline-smb"].tools, on["frontline-smb"].tools,
    "if both branches match, the toggle is not wired to anything");
});

console.log(`\n${n} checks passed.`);
