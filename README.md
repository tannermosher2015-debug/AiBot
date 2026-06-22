# Real Estate Lead Bot — Maui County

An AI lead-response & booking assistant for Maui real estate agents, built on the
Claude API. A buyer/seller messages the website chat widget → the AI instantly
responds, qualifies the lead (with real Maui know-how), searches listings, and books
a call or showing.

Runs **locally** (Express) and deploys to **Netlify** (serverless) from the same code.

## Project structure

| File | What it is |
|------|------------|
| `lib/bot.js` | The brain — system prompt, tools, Maui knowledge, and the chat logic. **Edit the `AGENT` config and `MODEL` here.** |
| `lib/listings.js` | Sample Maui/Molokai listings the bot can search (demo data). |
| `server.js` | Local dev server (run this on your machine). |
| `netlify/functions/chat.js` | The same bot, as a serverless function for Netlify. |
| `netlify.toml` | Netlify build + routing config. |
| `public/index.html` | The demo chat-widget page. |

## Run locally (5 minutes)

1. Install Node.js v18+: https://nodejs.org
2. In this folder: `npm install`
3. Copy `.env.example` to `.env` and paste your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get one at https://console.anthropic.com → Settings → API Keys.
4. `npm start`
5. Open http://localhost:3000

## Customizing for a client

Edit the `AGENT` object near the top of `lib/bot.js`:
```js
export const AGENT = {
  name: "Jordan Rivera",
  brokerage: "Valley Isle Realty",
  area: "Maui County, HI",
};
```
Also update the agent name/brokerage in `public/index.html` (header + avatar + welcome line).

## Switching models (cost)

In `lib/bot.js`:
```js
const MODEL = "claude-opus-4-8";   // most capable (default)
// const MODEL = "claude-sonnet-4-6";  // cheaper, still excellent
// const MODEL = "claude-haiku-4-5";   // cheapest + fastest
```

## Listings & MLS

The bot searches listings via the `search_listings` tool, reading from
`lib/listings.js` — **sample listings for demos only.** Don't present these to a real
buyer as live inventory.

**For a paying client**, swap the data source for their real listings:
- **Live MLS / IDX feed** via an approved vendor (SimplyRETS, Trestle/CoreLogic,
  Bridge/Zillow Group, Spark API) — requires the agent's MLS membership.
- Or start simple: load the agent's own active listings into `lib/listings.js`.

The tool contract stays the same — only the `searchListings()` body in `lib/bot.js`
changes. This is a premium, per-client add-on.

## Deploy to Netlify (live link)

1. Push this repo to GitHub (already done).
2. On Netlify: **Add new site → Import from GitHub →** pick the repo.
3. Build settings (mostly handled by `netlify.toml`):
   - Build command: `npm install`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. **Environment variables → Add:** `ANTHROPIC_API_KEY` = your key.
5. Deploy. You'll get a live URL like `https://your-site.netlify.app`.

The static page is served from `public/`, and the chat backend runs as the function
in `netlify/functions/chat.js` (the `/chat` request is routed there by `netlify.toml`).

## Next steps (productizing)

- **SMS** (Twilio) so it answers real phone leads.
- Connect `bookAppointment()` to a real calendar/CRM.
- Live MLS/IDX listing feed.
- Auto follow-up for cold leads.
