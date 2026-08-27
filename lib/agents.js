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
import { calendarEnabled, fetchAvailableSlots, createBooking, describeSlot, bookingTimeZone } from "./calcom.js";

/* ================== booking rules: chosen by whether Cal.com is on ======= */
// Defined ABOVE the prompts on purpose: they interpolate BOOKING_RULES at module
// load, so a definition further down the file is a temporal-dead-zone crash that
// `node --check` cannot see. Import the module to test it, never just lint it.
//
// The bot must never describe a capability it does not currently have. That is
// precisely the bug that shipped: the prompts promised booking, the code had none.

const BOOKING_RULES_OFF = `
# Booking: what you can and cannot do
- You CANNOT see anyone's calendar and you CANNOT reserve a time.
- NEVER invent or offer specific slots ("Thursday at 10am", "Friday at 2pm"). You have no idea what is free.
- NEVER say "booked", "locked in", "all set", "confirmed", or "you're scheduled" - not even loosely, and not even as a friendly sign-off. Nothing is reserved until THEY click the link and choose a slot themselves.
- Instead of a completion phrase, say what is actually true and hand over the link. For example: "Nothing's reserved yet - grab a time that suits you here: <link>".
- If they name a time, treat it as a preference you are passing to the team. Never echo it back as if it were held for them.`;

const BOOKING_RULES_ON = `
# Booking: you CAN reserve a real time
- Call check_availability to get REAL open slots from the live calendar. Offer two or three of them, using the wording the tool gives you.
- NEVER invent a time. If check_availability returns nothing, say you could not find an opening and hand over the link instead.
- To reserve you need their NAME and an EMAIL ADDRESS. A phone number alone cannot hold a slot. If they give only a phone, ask for an email so the invite can actually reach them; if they will not give one, capture the lead and hand over the link.
- Only say a time is booked AFTER the booking tool confirms it. The tool states plainly whether it worked.
- If the tool fails for any reason, say so simply and give them the link. Never cover a failure with a confident sign-off.`;

const BOOKING_RULES = calendarEnabled() ? BOOKING_RULES_ON : BOOKING_RULES_OFF;

// A lead gives ONE contact string; Cal.com needs an email to name an attendee.
const asEmail = (c) => (typeof c === "string" && c.includes("@") ? c.trim() : null);
const asPhone = (c) => (typeof c === "string" && !c.includes("@") ? c.trim() : null);

const checkAvailabilityTool = {
  name: "check_availability",
  description:
    "Look up REAL open appointment slots on the live calendar. Call this before offering any time. Returns slots you may read out verbatim, each with the exact start_iso to pass to the booking tool.",
  input_schema: { type: "object", properties: {}, required: [] },
};

async function runCheckAvailability() {
  const slots = await fetchAvailableSlots({ days: 7, limit: 6 });
  if (!slots.length) {
    return "No open slots came back from the calendar. Do NOT invent one - tell them you could not find an opening and offer the booking link.";
  }
  const lines = slots.map((iso) => "- " + describeSlot(iso) + "  [start_iso: " + iso + "]");
  return "Real open slots (times are " + bookingTimeZone() + "). Offer two or three, and pass the exact start_iso once they choose:\n" + lines.join("\n");
}

// Try a real reservation; fall back to the link, honestly, on every failure path.
async function runBooking({ brand, kind, input }) {
  await deliverLead({ brand, kind, input });
  const link = bookingLink();
  const email = asEmail(input.contact);
  const phone = asPhone(input.contact);

  if (calendarEnabled() && input.start_iso) {
    const r = await createBooking({
      start: input.start_iso,
      name: input.name,
      email,
      phone,
      notes: input.notes || input.current_setup,
    });
    if (r.booked) {
      return "CONFIRMED. The slot is reserved for " + describeSlot(r.start) + " and " + email
        + " will receive the calendar invite. You may tell them it is booked.";
    }
    if (r.reason === "email_required") {
      return 'NOT booked: reserving needs an email address and you only have "' + input.contact
        + '". Ask for an email, or hand over this link so they can book it themselves'
        + (link ? ": " + link : "") + ". Do NOT say it is booked.";
    }
    return "NOT booked (" + r.reason + "). Say the booking did not go through, and give them this link"
      + (link ? ": " + link : "") + ". Do NOT say it is booked.";
  }

  return "Lead handed to the " + brand + " team, who will reach them at " + input.contact
    + ". Nothing is reserved."
    + (link ? " Give them this link to pick their own time: " + link : "");
}



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
4. Once you know enough to be useful, offer a quick 15-minute call or a showing with the ${DAYNA.brokerage} team.
5. Once you have their name and a contact method, call the book_appointment tool. It passes the lead to the team and returns the real booking link.
${BOOKING_RULES}

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
    "Hand a qualified lead to the team and return the real booking link. This does NOT reserve a time and cannot see any calendar. Call it once you have their name and a contact method.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Lead's first name" },
      contact: { type: "string", description: "Phone number or email" },
      intent: { type: "string", enum: ["buying", "selling", "both"], description: "What the lead wants to do" },
      appointment_type: { type: "string", enum: ["call", "showing"], description: "Type of appointment" },
      start_iso: { type: "string", description: "The EXACT start_iso string from check_availability for the slot they chose. Include this ONLY when they picked one of those real slots. Omit it entirely otherwise." },
      preferred_time: { type: "string", description: "Any timing PREFERENCE they mentioned, in their own words, e.g. 'mornings' or 'later this week'. This is a hint for the team, NOT a reserved slot. Optional." },
      notes: { type: "string", description: "Anything useful for the agent: region, budget, timeline, buyer type, financing, STR intent, pre-approval, etc." },
    },
    required: ["name", "contact", "intent", "appointment_type"],
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
  tools: [
    ...(DAYNA_SHOW_LISTINGS ? [searchListingsTool] : []),
    ...(calendarEnabled() ? [checkAvailabilityTool] : []),
    bookAppointmentTool,
  ],
  async runTool(name, input) {
    if (name === "check_availability") return runCheckAvailability();
    if (name === "book_appointment") return runBooking({ brand: DAYNA.brokerage, kind: "appointment", input });
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
- Qualifies each lead (buyer vs seller, area, budget, timeline, pre-approval), hands it over instantly, and gives them the broker's booking link so they can pick a time themselves.
- Goes live in about 48 hours. One line of code; works on any site (custom, IDX, Squarespace, WordPress).
- It never invents listings or facts — it answers from what the broker provides, and hands warm leads to the agent with the full transcript.

# Your job
1. Understand their situation — solo agent, team, or brokerage? what market/area? how do they handle website leads today (a form, human chat, or nothing)? what's their biggest frustration?
2. Show, briefly and concretely, how Frontline AI fixes their specific gap. Lead with speed-to-lead: answering a new lead in seconds wins far more deals than answering an hour later.
3. Get their first name, a contact method (email or phone), and their brokerage/team name.
4. Offer a quick 15-minute strategy call to set it up, and point them at the booking link to pick a time that suits them.
5. Once you have their name and a contact method, call the book_call tool. It passes the lead to the team and returns the real booking link.
${BOOKING_RULES}

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
    "Hand a qualified broker lead to the team and return the real booking link for a 15-minute strategy call. This does NOT reserve a time and cannot see any calendar. Call it once you have their name and a contact method.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The broker's first name" },
      contact: { type: "string", description: "Email or phone" },
      business: { type: "string", description: "Their brokerage or team name. Optional." },
      market: { type: "string", description: "Their market / area, e.g. 'West Maui'. Optional." },
      current_setup: { type: "string", description: "How they handle website leads today and their main frustration. Optional." },
      start_iso: { type: "string", description: "The EXACT start_iso string from check_availability for the slot they chose. Include this ONLY when they picked one of those real slots. Omit it entirely otherwise." },
      preferred_time: { type: "string", description: "Any timing PREFERENCE they mentioned, in their own words, e.g. 'mornings' or 'later this week'. This is a hint for the team, NOT a reserved slot. Optional." },
    },
    required: ["name", "contact"],
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
  tools: [...(calendarEnabled() ? [checkAvailabilityTool] : []), bookCallTool],
  async runTool(name, input) {
    if (name === "check_availability") return runCheckAvailability();
    if (name === "book_call") return runBooking({ brand: "Frontline AI", kind: "call", input });
    return `Unknown tool: ${name}`;
  },
};

/* ============== FRONTLINE AI — SMALL BUSINESS (general) ================= */
// The bot for Frontline AI's small-business landing page (frontline-ai.html).
// It talks to OWNERS of any small business (not just real estate), explains the
// service in their terms, qualifies them, and books a free consultation.
// Pricing here MUST match the public page: $300 setup + $75/mo.
const frontlineSmbSystemPrompt = `You are the assistant for Frontline AI — a service by Frontline Web Designs that installs a custom 24/7 AI assistant on a small business's website. You're talking to a small-business owner or manager (restaurant, contractor, salon, clinic, shop, or any service business) who just landed on the Frontline AI page. They may be curious, skeptical, or comparing options.

The visitor has ALREADY seen a one-line welcome — don't repeat a greeting. Respond to what they say.

# What Frontline AI does (explain simply, in their terms)
- Puts a custom AI assistant on their website that answers customer questions instantly, 24/7 — nights, weekends, and while they're on the job.
- Captures and qualifies leads (name, contact, what they need) around the clock and hands them the booking link on the spot, so they stop losing after-hours and missed-call customers.
- Trained on THEIR specific business — services, pricing, hours, policies — so answers are accurate, not generic web filler. It hands warm leads straight to the owner.
- Custom-built and installed on their existing website. It knows when to hand off to a real person and never makes promises the business can't keep.

# Your job
1. Understand their business — what do they do, and how do they handle website questions/leads today (a form, phone tag, or nothing)? What's their biggest frustration (missed calls, after-hours leads, answering the same questions all day)?
2. Show, briefly and concretely, how Frontline AI fixes their specific gap. Lead with never missing a customer — answering instantly captures business a missed call or slow reply loses.
3. Get their first name, a contact method (email or phone), and their business name.
4. Offer a quick, free 15-minute consultation to scope it, and point them at the booking link to pick a time that suits them.
5. Once you have their name and a contact method, call the book_call tool. It passes the lead to the team and returns the real booking link.
${BOOKING_RULES}

# Pricing (be accurate — never overpromise)
- $300 one-time setup to build and train the assistant, then $75/month to host it, keep it accurate, and keep it running.
- No long-term contract — cancel anytime. Every project starts with a free consultation to scope it to their business.
- Never promise specific lead numbers or guaranteed results.

# Brand note
Frontline AI was built by a Hawaii firefighter — the idea is first-responder reliability for your customers: always on, never misses one. Mention it only when it fits naturally; don't force it.

# Style
- 1 to 3 short sentences per message. No long paragraphs. Ask ONE question at a time.
- Confident and specific, never hypey. No "amazing" / "revolutionary". Keep technical answers simple and offer to cover details on the call.
- Persistent but never pushy. Always moving toward booking the free consultation.`;

const bookCallToolSmb = {
  name: "book_call",
  description:
    "Hand a qualified small-business lead to the team and return the real booking link for a free 15-minute consultation. This does NOT reserve a time and cannot see any calendar. Call it once you have their name and a contact method.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The owner's first name" },
      contact: { type: "string", description: "Email or phone" },
      business: { type: "string", description: "Their business name. Optional." },
      business_type: { type: "string", description: "What kind of business, e.g. 'plumbing', 'salon', 'restaurant'. Optional." },
      current_setup: { type: "string", description: "How they handle website questions/leads today and their main frustration. Optional." },
      start_iso: { type: "string", description: "The EXACT start_iso string from check_availability for the slot they chose. Include this ONLY when they picked one of those real slots. Omit it entirely otherwise." },
      preferred_time: { type: "string", description: "Any timing PREFERENCE they mentioned, in their own words, e.g. 'mornings' or 'later this week'. This is a hint for the team, NOT a reserved slot. Optional." },
    },
    required: ["name", "contact"],
  },
};

const frontlineSmb = {
  key: "frontline-smb",
  name: "Frontline AI",
  brokerage: "Frontline AI",
  area: "Hawaii",
  brand: "Frontline AI",
  greeting: "👋 Aloha! I'm the Frontline AI assistant. Ask me anything about how a 24/7 assistant could work for your business — or I can set you up with a free consultation.",
  theme: { primary: "#E89A3C", header: "#0A0A0B", status: "#6FCF87" },
  systemPrompt: frontlineSmbSystemPrompt,
  tools: [...(calendarEnabled() ? [checkAvailabilityTool] : []), bookCallToolSmb],
  async runTool(name, input) {
    if (name === "check_availability") return runCheckAvailability();
    if (name === "book_call") return runBooking({ brand: "Frontline AI", kind: "call", input });
    return `Unknown tool: ${name}`;
  },
};

/* ============================ registry ================================== */
const AGENTS = { dayna, frontline, "frontline-smb": frontlineSmb };

export function getActiveAgent() {
  const key = (process.env.BOT_AGENT || "dayna").toLowerCase();
  const agent = AGENTS[key];
  if (!agent) {
    const valid = Object.keys(AGENTS).join(", ");
    throw new Error(`Unknown BOT_AGENT "${key}". Valid options: ${valid}.`);
  }
  return agent;
}

// Resolve a per-request agent by key (from ?agent= / body.agent). Allowlisted:
// unknown or missing keys safely fall back to the deploy's default agent, so a
// caller can never inject an arbitrary persona.
export function getAgent(key) {
  if (key && typeof key === "string") {
    const agent = AGENTS[key.toLowerCase()];
    if (agent) return agent;
  }
  return getActiveAgent();
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
    // Diagnostic only: says whether real Cal.com booking is configured on THIS
    // deploy. A boolean, never the key or the event type id. Without it, working
    // out why booking is inert means guessing at a dashboard nobody can read
    // remotely, which is exactly where an hour went on 2026-08-26.
    calendarEnabled: calendarEnabled(),
  };
}

export { AGENTS };
