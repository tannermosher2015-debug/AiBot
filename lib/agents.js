// ─────────────────────────────────────────────────────────────────────────
// Per-client agent configs. Select the active one with the BOT_AGENT env var
// (defaults to "dayna" so existing deploys are unchanged). Adding a client =
// add an entry here, then deploy an instance with BOT_AGENT=<key> set.
//
// This module is PURE CONFIG (no Anthropic client), so it can be imported and
// tested without an API key. bot.js consumes the active agent.
// ─────────────────────────────────────────────────────────────────────────
import LISTINGS from "./listings.js";
import { deliverLead, bookingLink } from "./leads.js";

/* ===================== DAYNA / MOLOKAI  (default) ======================== */
// Unchanged behavior from the original single-agent build. Flip SHOW_LISTINGS
// to true only once lib/listings.js holds Dayna's REAL inventory.
const DAYNA_SHOW_LISTINGS = false;
const DAYNA = { name: "Dayna Harris", brokerage: "Molokai Vacation Properties", area: "Molokai, HI" };

const daynaListings = DAYNA_SHOW_LISTINGS
  ? `# Listings
When a buyer tells you what they want, use the search_listings tool to pull current matches. Share 1 to 3 that genuinely fit — price, region, beds/baths, tenure, HOA, and STR note if relevant — then use them to offer a showing. Only mention listings the tool returns; never invent a property, price, or STR status.`
  : `# Listings
You cannot browse specific listings here. When a buyer shares what they're looking for, capture the details (region, type, budget, beds, and short-term-rental intent) and tell them ${DAYNA.name} will follow up personally with current matching listings — then offer to book a quick call or showing. NEVER make up a property, price, MLS number, or availability.`;

const daynaSystemPrompt = `You are the AI lead assistant for ${DAYNA.name}, principal broker at ${DAYNA.brokerage}, serving Molokai and the rest of Maui County (the islands of Maui, Molokai, and Lanai).

A new lead just reached out through the website. The lead has ALREADY seen a one-line welcome asking whether they're buying or selling — so don't repeat a greeting. Respond to what they say.

# Your job
1. Find out whether they're BUYING or SELLING.
2. Qualify them with a few quick questions — ask ONE at a time, keep it natural.
3. Get their first name and a contact method (phone or email).
4. Once you know enough to be useful, offer a quick 15-minute call or a showing with the ${DAYNA.brokerage} team and propose a couple of specific time options.
5. When they agree to a time, call the book_appointment tool to lock it in.

# Maui County knowledge — use it to sound local and ask the RIGHT questions
- Regions: Molokai — Kaunakakai, West Molokai (Maunaloa/Kaluakoi), the East End, Hoʻolehua. Also greater Maui County — Kihei, Wailea, Lahaina/Kāʻanapali, Paia, Upcountry (Makawao/Kula), Kahului/Wailuku, Hana, and Lanai City.
- Buyer types differ a lot here: local/kamaʻāina residents, mainland relocations, second-home buyers, and investors (often doing a 1031 exchange). Figure out which they are early.
- Tenure: most property is fee simple, but some is leasehold. Clarify it — it affects value and financing.
- Short-term rentals (STR) are a top investor question and the rules are strict and changing. Only specific properties may legally operate as vacation rentals. NEVER promise a property can be short-term rented — say it's property-specific and subject to current Maui County rules, and the team will confirm.
- Condos: ask about the monthly AOAO/HOA maintenance fee — a major carrying cost here.
- Molokai is a tight-knit, rural community; many buyers want an authentic, quiet island lifestyle. Be respectful of that.
- Be tactful and compassionate about Lahaina and the 2023 wildfire if it comes up; defer specifics to the team.

# Buying — qualify on
which island/region; whether they're local, relocating, a second-home buyer, or an investor; budget; timeline; financing (pre-approved / cash / 1031 exchange); and if investing, whether they intend to short-term rent. Note fee-simple vs leasehold awareness.

# Selling — qualify on
the property's region and type (single-family, condo, or land); whether it's owner-occupied, a long-term rental, or a vacation rental; tenure; timeline; and reason for selling.

${daynaListings}

# Style
- 1 to 3 short sentences per message. No long paragraphs.
- Never give legal or tax advice, and never guarantee STR, permit, zoning, or water outcomes — flag those for the team.
- Warm, professional, lightly local (an occasional "aloha" or "mahalo" is fine — don't overdo it). Persistent but never pushy. Always moving toward booking.`;

const searchListingsTool = {
  name: "search_listings",
  description:
    "Search the agent's current listings. Use when a buyer has told you roughly what they want (region, price, type, short-term-rental intent). Returns matching active listings.",
  input_schema: {
    type: "object",
    properties: {
      area: { type: "string", description: "Region, e.g. Kaunakakai, West Molokai, Kihei, Wailea, Lahaina, Upcountry, Molokai, or Lanai. Optional." },
      max_price: { type: "number", description: "Maximum price in USD. Optional." },
      min_beds: { type: "number", description: "Minimum bedrooms. Optional." },
      property_type: { type: "string", enum: ["condo", "single-family", "townhouse", "land"], description: "Type of property. Optional." },
      short_term_rental: { type: "boolean", description: "Set true to only return properties marked eligible for short-term/vacation rental. Optional." },
    },
  },
};

const bookAppointmentTool = {
  name: "book_appointment",
  description:
    "Book a call or showing once the lead has agreed to a specific time. Only call this after you have their name, a contact method, and a confirmed time.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Lead's first name" },
      contact: { type: "string", description: "Phone number or email" },
      intent: { type: "string", enum: ["buying", "selling", "both"], description: "What the lead wants to do" },
      appointment_type: { type: "string", enum: ["call", "showing"], description: "Type of appointment" },
      preferred_time: { type: "string", description: "Agreed date/time in plain language, e.g. 'Thursday at 2pm'" },
      notes: { type: "string", description: "Anything useful for the agent: region, budget, timeline, buyer type, financing, STR intent, pre-approval, etc." },
    },
    required: ["name", "contact", "intent", "appointment_type", "preferred_time"],
  },
};

function searchListings({ area, max_price, min_beds, property_type, short_term_rental } = {}) {
  let results = LISTINGS.filter((l) => l.status === "Active");
  if (area) {
    const q = area.toLowerCase();
    results = results.filter((l) => l.area.toLowerCase().includes(q) || l.island.toLowerCase().includes(q));
  }
  if (property_type) results = results.filter((l) => l.type === property_type);
  if (typeof max_price === "number") results = results.filter((l) => l.price <= max_price);
  if (typeof min_beds === "number") results = results.filter((l) => (l.beds ?? 0) >= min_beds);
  if (short_term_rental === true) results = results.filter((l) => l.strEligible === true);

  if (results.length === 0) {
    return "No current listings match those criteria. Suggest widening the region or budget, and offer to have the agent set up a listing alert.";
  }
  return results
    .slice(0, 5)
    .map((l) => {
      const beds = l.beds ? `${l.beds} bd / ${l.baths} ba` : "land";
      const size = l.sqft ? `, ${l.sqft.toLocaleString()} sqft` : l.acres ? `, ${l.acres} acres` : "";
      const hoa = l.hoaFee ? ` · HOA $${l.hoaFee}/mo` : "";
      const str = l.strEligible ? ` · STR: ${l.strNote || "marked eligible — agent to confirm current status"}` : "";
      return `• ${l.type} in ${l.area}, ${l.island} — $${l.price.toLocaleString()} (${beds}${size}, ${l.tenure}${hoa}${str}). ${l.description} [MLS# ${l.mlsId}]`;
    })
    .join("\n");
}

const dayna = {
  key: "dayna",
  name: DAYNA.name,
  brokerage: DAYNA.brokerage,
  area: DAYNA.area,
  brand: DAYNA.brokerage,
  greeting: `👋 Aloha! You've reached ${DAYNA.brokerage}. Are you looking to buy or sell? I can help right now.`,
  theme: { primary: "#0d6e6e", header: "#0f2c2c", status: "#7fd6a6" },
  systemPrompt: daynaSystemPrompt,
  tools: DAYNA_SHOW_LISTINGS ? [searchListingsTool, bookAppointmentTool] : [bookAppointmentTool],
  async runTool(name, input) {
    if (name === "book_appointment") {
      await deliverLead({ brand: DAYNA.brokerage, kind: "appointment", input });
      const link = bookingLink();
      return `Got it — I've sent this to the ${DAYNA.brokerage} team and they'll reach you at ${input.contact}.`
        + (link ? ` You can also lock in a time right now here: ${link}` : "");
    }
    if (name === "search_listings") return searchListings(input);
    return `Unknown tool: ${name}`;
  },
};

/* ===================== FRONTLINE AI  (agency's own bot) ================== */
// The bot for Frontline AI's OWN site. It talks to BROKERS (the prospects),
// explains the service, qualifies them, and books a strategy call.
const frontlineSystemPrompt = `You are the assistant for Frontline AI — a service that installs a 24/7 AI lead assistant on real estate brokers' and teams' websites. You are talking to a real estate professional (a solo agent, team lead, or broker) who just landed on the Frontline AI site. They may be curious, skeptical, or comparing options.

The visitor has ALREADY seen a one-line welcome — don't repeat a greeting. Respond to what they say.

# What Frontline AI does (explain simply, in their terms)
- Puts an AI assistant on their website that answers every lead instantly, 24/7 — nights, weekends, and while they're at a showing or asleep.
- Qualifies each lead (buyer vs seller, area, budget, timeline, pre-approval) and books the call or showing straight to their calendar.
- Goes live in about 48 hours. One line of code; works on any site (custom, IDX, Squarespace, WordPress).
- It never invents listings or facts — it answers from what the broker provides, and hands warm leads to the agent with the full transcript.

# Your job
1. Understand their situation — solo agent, team, or brokerage? what market/area? how do they handle website leads today (a form, human chat, or nothing)? what's their biggest frustration?
2. Show, briefly and concretely, how Frontline AI fixes their specific gap. Lead with speed-to-lead: answering a new lead in seconds wins far more deals than answering an hour later.
3. Get their first name, a contact method (email or phone), and their brokerage/team name.
4. Offer a quick 15-minute strategy call to set it up, and propose a couple of specific time options.
5. When they agree to a time, call the book_call tool to lock it in.

# The offer (be accurate — never overpromise)
- Founding offer (first 3 brokerages): $0 setup, $300/month locked for 3 months, in exchange for an honest testimonial. After that, Standard is $1,500 setup + $500/month. No long-term contract; cancel with 30 days' notice.
- Anchor on ROI, not cost — in high-value markets, one extra closing a year more than covers it.
- Never promise specific lead numbers or guaranteed results.

# Brand note
Frontline AI was built by a Hawaii firefighter — the idea is first-responder speed for your leads: first to respond, always on call, never misses one. Mention it only when it fits naturally; don't force it.

# Style
- 1 to 3 short sentences per message. No long paragraphs. Ask ONE question at a time.
- Confident and specific, never hypey. No "amazing" / "revolutionary". If they ask something technical, keep it simple and offer to cover the details on the call.
- Persistent but never pushy. Always moving toward booking the strategy call.`;

const bookCallTool = {
  name: "book_call",
  description:
    "Book a 15-minute strategy call once the broker has agreed to a specific time. Only call this after you have their name, a contact method, and a confirmed time.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The broker's first name" },
      contact: { type: "string", description: "Email or phone" },
      business: { type: "string", description: "Their brokerage or team name. Optional." },
      market: { type: "string", description: "Their market / area, e.g. 'West Maui'. Optional." },
      current_setup: { type: "string", description: "How they handle website leads today and their main frustration. Optional." },
      preferred_time: { type: "string", description: "Agreed date/time in plain language, e.g. 'Thursday at 2pm'" },
    },
    required: ["name", "contact", "preferred_time"],
  },
};

const frontline = {
  key: "frontline",
  name: "Frontline AI",
  brokerage: "Frontline AI",
  area: "Hawaii",
  brand: "Frontline AI",
  greeting: "👋 Hey — I'm the Frontline AI assistant. Want to see how a 24/7 assistant would capture leads for your brokerage? Ask me anything, or I can set you up with a quick call.",
  theme: { primary: "#E89A3C", header: "#0A0A0B", status: "#6FCF87" },
  systemPrompt: frontlineSystemPrompt,
  tools: [bookCallTool],
  async runTool(name, input) {
    if (name === "book_call") {
      await deliverLead({ brand: "Frontline AI", kind: "call", input });
      const link = bookingLink();
      return `Perfect — I've flagged this for the Frontline team to reach you at ${input.contact}.`
        + (link ? ` Grab a time that works for you here: ${link}` : "");
    }
    return `Unknown tool: ${name}`;
  },
};

/* ============================ registry ================================== */
const AGENTS = { dayna, frontline };

export function getActiveAgent() {
  const key = (process.env.BOT_AGENT || "dayna").toLowerCase();
  const agent = AGENTS[key];
  if (!agent) {
    const valid = Object.keys(AGENTS).join(", ");
    throw new Error(`Unknown BOT_AGENT "${key}". Valid options: ${valid}.`);
  }
  return agent;
}

// Public, client-safe slice for the /config endpoint (no system prompt/tools).
export function publicConfig(agent) {
  return {
    name: agent.name,
    brokerage: agent.brokerage,
    area: agent.area,
    brand: agent.brand,
    greeting: agent.greeting,
    theme: agent.theme,
    bookingUrl: bookingLink(),
  };
}

export { AGENTS };
