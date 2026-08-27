# real-estate-lead-bot - repo rules

Originally retrofitted by `/init-client --retrofit` on 2026-08-21 from what was on disk.
**The Deploy target and "does a push publish" sections were WRONG and were corrected
2026-08-26 against the running service.** See below for what was measured.

## Stack
Node project. `npm start` runs `server.js` (Express). See `package.json`.

## What this repo actually is
One backend serving THREE personas from `lib/agents.js`: `dayna` (Molokai Vacation
Properties, a real client), `frontline` (agency bot, pitches brokers), and
`frontline-smb` (agency bot, pitches any small business). The widget picks one with
`data-agent` on the script tag or the inline mount. `BOT_AGENT` sets the default and
**defaults to `dayna`, another client's persona, if unset.**

## Deploy target
**Render.** Live at `https://aibot-rl1g.onrender.com`, on the paid **Starter** plan.
It runs `server.js`, NOT the Netlify function.

`netlify.toml` and `netlify/functions/chat.js` are present on disk and are NOT the live
path. Do not read their presence as the deploy target, which is exactly the mistake the
2026-08-21 retrofit made. The Netlify function also has no rate limiting, by its own
admission, so moving to it would lose a protection `server.js` has.

## Does a push publish?
**YES.** Render Auto-Deploy is ON (confirmed by Tanner 2026-08-26). Measured the same
evening: two pushes went live **45s** and **~60s** after `git push`.

The old answer here was **NO**, justified by `gh api repos/<owner>/<repo>/hooks` returning
nothing. That test is the wrong one for Render, for the same reason the file already
documented for Hostinger and Vercel: **Render's GitHub integration registers no repo-level
webhook.** A zero from that command does not mean a repo cannot auto-deploy. Ask the
dashboard, or push once and time the result.

## Starter plan: no spin-down
Measured 2026-08-26: after **17 minutes idle**, `widget.js` answered in **0.37s** and
`/chat` in **0.25s**. There is no cold-start problem on this plan.

`.github/workflows/keepalive.yml` used to ping `/config` every 13 minutes to dodge free-tier
sleep. It was deleted 2026-08-26 as waste. **If this service is ever downgraded to Render's
free tier, restore it** (see git history).

## Verify path
**`npm test` first.** It runs `lib/calcom.test.js` and `lib/agents.test.js`: slot parsing,
and the assertion that the prompt and tool list follow the calendar configuration. Each
suite ends with a control that must fail, so a suite asserting nothing cannot pass quietly.

**`node --check` is not enough on `lib/agents.js`.** The prompts interpolate `BOOKING_RULES`
at module load, so a definition placed below them is a temporal-dead-zone crash that lints
clean. IMPORT the module (`node -e "import('./lib/agents.js')"`), do not just lint it.
Measured 2026-08-26, that exact mistake.

NOT `shot.ps1`. This repo is a backend plus an embeddable widget; there is no page of its
own worth shooting. Verify instead:
- **Backend:** replay a real conversation against `POST /chat` with
  `{"messages":[...], "agent":"<key>"}` and assert on what it says. Booking honesty has a
  written rule (below), so assert the banned phrases are absent AND run a control string
  that must match, or the check passes by matching nothing.
- **Widget:** load a page that embeds it and read the shadow root. Everything lives inside
  `#lead-bot-host`, so `document.querySelector('*')` will NOT see the bubble. Pierce with
  `document.querySelector('#lead-bot-host').shadowRoot`.

## Real booking (Cal.com)
`lib/calcom.js`. **OFF unless BOTH `CALCOM_API_KEY` and `CALCOM_EVENT_TYPE_ID` are set**;
half-configured counts as off. When off, the bot keeps the honest fallback: capture the
lead, hand over `BOOKING_URL`, claim nothing. When on, it gains a `check_availability`
tool and can make real reservations, and the prompt swaps to the can-book ruleset.

**Cal.com versions per endpoint and the two values differ.** Slots want
`cal-api-version: 2024-09-04`, bookings want `2026-02-25`. The wrong value does not error,
it silently serves an older shape. Both read from cal.com's API reference 2026-08-26.
`GET /v2/slots` returns an object keyed by DATE, not an array.

**Cal.com needs an EMAIL to name an attendee**, so a phone-only lead cannot be booked.
That path is handled explicitly and tells the model to ask for an email rather than
pretend it worked.

## Landmines
- **2026-08-26: the bot claimed to book appointments it cannot make.** There is NO calendar
  integration in this repo. Every persona's prompt said "call the book_* tool to lock it
  in", so the model told real leads "Locked in for Thursday at 10am" and invented the slots.
  Each persona now carries an explicit block: it cannot see a calendar, cannot reserve a
  time, must never invent slots, and must never say "booked"/"locked in"/"all set". **If you
  edit these prompts, re-run the replay check.** A flat prohibition was not enough on its
  own; the rule only held once it also told the model what to say instead.
- **2026-08-26: `BOT_AGENT` defaults to `dayna`.** An unset value silently serves a
  different client's persona rather than failing. Always set it explicitly.
- **2026-08-26: `ALLOWED_ORIGINS` fails closed.** Unset means every cross-origin browser
  call is refused and the widget silently does not work. Nothing logs a rejection loudly.
- **2026-08-26: lead delivery fails silently.** Without `RESEND_API_KEY` and
  `LEAD_NOTIFY_EMAIL`, `lib/leads.js` only `console.log`s the lead. On Render that is a log
  nobody reads. The conversation still looks perfect to the customer.

## Remote
`git@github.com:tannermosher2015-debug/AiBot.git`, branch `main`.
