// Netlify serverless function — the production backend for the chat widget.
// It runs the SAME bot logic as the local server (shared in lib/bot.js).
// The frontend POSTs to /chat, which netlify.toml rewrites to this function.
import { runChat } from "../../lib/bot.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const { reply, messages } = await runChat(body.messages);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply, messages }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Something went wrong." }),
    };
  }
};
