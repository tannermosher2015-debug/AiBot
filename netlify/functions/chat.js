// Netlify serverless function — the production backend for the chat widget.
// It runs the SAME bot logic as the local server (shared in lib/bot.js).
// The frontend POSTs to /chat, which netlify.toml rewrites to this function.
import { runChat } from "../../lib/bot.js";

// Per-request guards ported from server.js (express.json limit + validateChat).
// NOTE: a per-IP rate limit can't live here — serverless invocations don't share
// memory, so an in-memory limiter resets every call. Real throttling needs a shared
// store (e.g. Upstash Redis / Netlify's rate-limit config). These size/count caps
// are the guards that work statelessly and bound per-request abuse.
const MAX_BODY_BYTES = 120 * 1024; // 120kb, matches server.js express.json limit
const MAX_MESSAGES = 60;           // matches server.js validateChat

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  const raw = event.body || "";
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json(413, { error: "Payload too large." });
  }
  try {
    const body = JSON.parse(raw || "{}");
    const messages = body && body.messages;
    if (!Array.isArray(messages)) {
      return json(400, { error: "Invalid request." });
    }
    if (messages.length > MAX_MESSAGES) {
      return json(400, { error: "This conversation is quite long. Please start a new chat." });
    }
    const { reply, messages: out } = await runChat(messages);
    return json(200, { reply, messages: out });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Something went wrong." });
  }
};
