// Shared bot logic — used by BOTH the local Express server (server.js)
// and the Netlify serverless function (netlify/functions/chat.js).
import Anthropic from "@anthropic-ai/sdk";
import LISTINGS from "./listings.js";

// Reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

// ── Model ──────────────────────────────────────────────────────────────
// Default: the latest, most capable model. For a high-volume production
// lead bot, switch to "claude-sonnet-4-6" (cheaper) or "claude-haiku-4-5"
// (cheapest + fastest). One-line change.
const MODEL = "claude-opus-4-8";

// ── Per-client config (customize this for each agent) ────────────────────
export const AGENT = {
  name: "Jordan Rivera",            // placeholder — replace with the real agent's name
  brokerage: "Valley Isle Realty",  // placeholder — replace with their brokerage
  area: "Maui County, HI",
};

const SYSTEM_PROMPT = `You are the AI lead assistant for ${AGENT.name}, a real estate agent at ${AGENT.brokerage} serving ${AGENT.area} — the islands of Maui, Molokai, and Lanai.

A new lead just reached out through the website. The lead has ALREADY seen a one-line welcome asking whether they're buying or selling — so don't repeat a greeting. Respond to what they say.

# Your job
1. Find out whether they're BUYING or SELLING.
2. Qualify them with a few quick questions — ask ONE at a time, keep it natural.
3. Get their first name and a contact method (phone or email).
4. Once you know enough to be useful, offer a quick 15-minute call or a showing with ${AGENT.name} and propose a couple of specific time options.
5. When they agree to a time, call the book_appointment tool to lock it in.

# Maui County knowledge — use it to sound local and ask the RIGHT questions
- Regions you serve: Maui — Kihei, Wailea, Makena, Maalaea, Lahaina, Kāʻanapali, Honokowai, Napili, Kapalua, Wailuku, Kahului, Waiehu, Paia, Haiku, Makawao, Pukalani, Kula (Upcountry), Hana. Molokai — Kaunakakai, West Molokai, the East End. Lanai — Lanai City.
- Buyer types differ a lot here: local/kamaʻāina residents, mainland relocations, second-home buyers, and investors (often doing a 1031 exchange). Figure out which they are early — it changes everything.
- Tenure: most property is fee simple, but some is leasehold. Clarify it, since it affects value and financing.
- Short-term rentals (STR) are the #1 investor question on Maui, and the rules are strict and changing. Only specific properties may legally operate as vacation rentals (e.g. certain "Minatoya list" condos and permitted TVRs). NEVER promise that a property can be short-term rented — say STR eligibility is property-specific and subject to current Maui County rules, and ${AGENT.name} will confirm the exact status. If a listing's data marks it STR-eligible you may share that, with the same caveat.
- Condos: ask about the monthly AOAO/HOA maintenance fee — it's a major carrying cost here.
- Upcountry / ag land: an ohana (second dwelling) may be possible but often hinges on the Upcountry water-meter waitlist — flag it for the agent, don't promise.
- Be tactful and compassionate about Lahaina and the 2023 wildfire. If it comes up, don't pry; let the lead lead, and defer specifics to ${AGENT.name}.

# Buying — qualify on
which region; whether they're local, relocating, a second-home buyer, or an investor; budget; timeline; financing (pre-approved / cash / 1031 exchange); and if they're investing, whether they intend to short-term rent. Note fee-simple vs leasehold awareness.

# Selling — qualify on
the property's region and type (single-family, condo, or land); whether it's owner-occupied, a long-term rental, or a vacation rental; tenure; timeline; and reason for selling.

# Listings
When a buyer tells you what they want, use the search_listings tool to pull current matches. Share 1 to 3 that genuinely fit — price, region, beds/baths, tenure, HOA, and STR note if relevant — then use them to offer a showing. Only mention listings the tool returns; never invent a property, price, or STR status.

# Style
- 1 to 3 short sentences per message. No long paragraphs.
- Never give legal or tax advice, and never guarantee STR, permit, zoning, or water outcomes — flag those for ${AGENT.name}.
- Warm, professional, lightly local (an occasional "aloha" or "mahalo" is fine — don't overdo it). Persistent but never pushy. Always moving toward booking.`;

const tools = [
  {
    name: "search_listings",
    description:
      "Search the agent's current listings. Use when a buyer has told you roughly what they want (region, price, type, short-term-rental intent). Returns matching active listings.",
    input_schema: {
      type: "object",
      properties: {
        area: {
          type: "string",
          description:
            "Region, e.g. Kihei, Wailea, Lahaina, Kaanapali, Paia, Upcountry, Kahului, Hana, Molokai, or Lanai. Optional.",
        },
        max_price: { type: "number", description: "Maximum price in USD. Optional." },
        min_beds: { type: "number", description: "Minimum bedrooms. Optional." },
        property_type: {
          type: "string",
          enum: ["condo", "single-family", "townhouse", "land"],
          description: "Type of property. Optional.",
        },
        short_term_rental: {
          type: "boolean",
          description:
            "Set true to only return properties marked eligible for short-term/vacation rental. Optional.",
        },
      },
    },
  },
  {
    name: "book_appointment",
    description:
      "Book a call or showing once the lead has agreed to a specific time. Only call this after you have their name, a contact method, and a confirmed time.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Lead's first name" },
        contact: { type: "string", description: "Phone number or email" },
        intent: {
          type: "string",
          enum: ["buying", "selling", "both"],
          description: "What the lead wants to do",
        },
        appointment_type: {
          type: "string",
          enum: ["call", "showing"],
          description: "Type of appointment",
        },
        preferred_time: {
          type: "string",
          description: "Agreed date/time in plain language, e.g. 'Thursday at 2pm'",
        },
        notes: {
          type: "string",
          description:
            "Anything useful for the agent: region, budget, timeline, buyer type, financing, STR intent, pre-approval, etc.",
        },
      },
      required: ["name", "contact", "intent", "appointment_type", "preferred_time"],
    },
  },
];

// Search the demo listings. In production, swap this body for a call to the
// agent's MLS/IDX feed (the input schema and tool contract stay the same).
function searchListings({ area, max_price, min_beds, property_type, short_term_rental } = {}) {
  let results = LISTINGS.filter((l) => l.status === "Active");

  if (area) {
    const q = area.toLowerCase();
    results = results.filter(
      (l) => l.area.toLowerCase().includes(q) || l.island.toLowerCase().includes(q)
    );
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
      const size = l.sqft
        ? `, ${l.sqft.toLocaleString()} sqft`
        : l.acres
        ? `, ${l.acres} acres`
        : "";
      const hoa = l.hoaFee ? ` · HOA $${l.hoaFee}/mo` : "";
      const str = l.strEligible
        ? ` · STR: ${l.strNote || "marked eligible — agent to confirm current status"}`
        : "";
      return `• ${l.type} in ${l.area}, ${l.island} — $${l.price.toLocaleString()} (${beds}${size}, ${l.tenure}${hoa}${str}). ${l.description} [MLS# ${l.mlsId}]`;
    })
    .join("\n");
}

// In production this would write to a real calendar / CRM
// (Calendly, Google Calendar, Follow Up Boss, kvCore, etc.).
function bookAppointment(input) {
  console.log("\n📅  NEW APPOINTMENT BOOKED");
  console.log(JSON.stringify(input, null, 2), "\n");
  return `Appointment confirmed and added to ${AGENT.name}'s calendar. A confirmation has been sent to ${input.contact}.`;
}

// Run one chat turn (stateless): takes the full message history, returns the
// assistant's reply plus the updated history. Works the same locally and serverless.
export async function runChat(incomingMessages) {
  const messages = Array.isArray(incomingMessages) ? incomingMessages : [];

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        let result;
        if (block.name === "book_appointment") result = bookAppointment(block.input);
        else if (block.name === "search_listings") result = searchListings(block.input);
        else result = `Unknown tool: ${block.name}`;
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });
      continue; // loop so Claude can respond after using a tool
    }

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    messages.push({ role: "assistant", content: response.content });
    return { reply, messages };
  }
}
