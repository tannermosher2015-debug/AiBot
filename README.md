# Real Estate Lead Bot — Demo

An AI lead-response & booking assistant for real estate agents, built on the Claude API.
A buyer/seller messages the website chat widget → the AI instantly responds, qualifies
the lead, answers basic questions, and books a call or showing.

**This is your demo piece** — the thing you show agents before you pitch them.

## What it does

- Greets a new lead and asks if they're **buying or selling**
- Qualifies them (area, budget, timeline, pre-approval / property details)
- Searches current listings and recommends matches (demo data — swap for live MLS in production)
- Captures name + contact
- Proposes times and **books the appointment** via a tool call
- Booking is printed to the server console (in production: wire to Calendly / Google
  Calendar / a CRM like Follow Up Boss)

## Setup (5 minutes)

1. **Install Node.js** (v18+) if you don't have it: https://nodejs.org

2. **Install dependencies** (run in this folder):
   ```
   npm install
   ```
   (To make sure you get current versions: `npm install express @anthropic-ai/sdk dotenv`)

3. **Add your API key**: copy `.env.example` to `.env` and paste your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get one at https://console.anthropic.com → Settings → API Keys.

4. **Run it**:
   ```
   npm start
   ```

5. Open **http://localhost:3000** and chat with the widget. Watch the server
   console — when the bot books an appointment, the structured details print there.

## Customizing for a client

Open `server.js` and edit the `AGENT` object near the top:
```js
const AGENT = {
  name: "Jordan Rivera",
  brokerage: "Skyline Realty",
  area: "Austin, TX",
};
```
Update the agent's name/brokerage/area in `public/index.html` too (header + avatar +
welcome line). That's the whole customization for a new client.

## Switching models (cost)

In `server.js`:
```js
const MODEL = "claude-opus-4-8";   // most capable (default)
// const MODEL = "claude-sonnet-4-6";  // cheaper, still excellent — good for production
// const MODEL = "claude-haiku-4-5";   // cheapest + fastest
```

## Listings & MLS

The bot can search listings via the `search_listings` tool. Right now it reads from
`listings.json` — **sample Maui/Molokai listings for demos only.** Do not present
these to a real buyer as live inventory.

**For a paying client**, swap the data source for their real listings:
- **Live MLS / IDX feed** via an approved vendor (SimplyRETS, Trestle/CoreLogic,
  Bridge/Zillow Group, Spark API) — requires the agent's MLS membership and, with
  some vendors, a small monthly fee.
- Or start simple: load the agent's own active listings into `listings.json`.

The tool's input/output contract stays the same — only the `searchListings()` body
in `server.js` changes. This is a premium, per-client add-on.

## Next steps (productizing this)

- Swap the web widget for **SMS** (Twilio) so it answers real phone leads.
- Connect `bookAppointment()` to a real calendar/CRM.
- Add lead capture → push qualified leads into the agent's CRM automatically.
- Deploy so it runs 24/7 (Render, Railway, Fly.io, a VPS, etc.).
