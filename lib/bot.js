// Shared bot logic — used by the local Express server (server.js), the Netlify
// function (netlify/functions/chat.js), and the embeddable widget.
//
// The persona/branding/tools come from lib/agents.js, selected by the BOT_AGENT
// env var (default "dayna"). One deploy = one agent. Add a client in agents.js
// and deploy an instance with BOT_AGENT=<key>.
import Anthropic from "@anthropic-ai/sdk";
import { getActiveAgent, publicConfig } from "./agents.js";

// Reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

// ── Model ──────────────────────────────────────────────────────────────
// Default: the latest, most capable model. For a high-volume production
// lead bot, switch to "claude-sonnet-5" (cheaper) or "claude-haiku-4-5".
const MODEL = "claude-opus-5";

// The active agent for this deploy.
export const AGENT = getActiveAgent();

// Client-safe config for the /config endpoint (used by the widget for branding).
export const CONFIG = publicConfig(AGENT);

// Cap on tool-use rounds in one turn — a backstop against a runaway loop.
const MAX_TOOL_ROUNDS = 6;

// A booking tool fires real emails (Resend). Cap booking actions to one per
// request so a client can't drive the model to fire a burst of them. Booking
// tools are named book_* (book_appointment, book_call).
const isBookingTool = (name) => typeof name === "string" && name.startsWith("book_");

// Drop tool turns from the CLIENT-supplied history: this bot is stateless and the
// client holds the transcript, so it could fabricate tool_result blocks to feed the
// model fake tool outputs. Only tool turns generated inside this call are trusted, so
// strip tool_use / tool_result blocks from incoming history and keep plain-text turns.
function stripClientToolTurns(messages) {
  return messages
    .map((m) => {
      if (!m || !Array.isArray(m.content)) return m;
      return { ...m, content: m.content.filter((b) => b && b.type !== "tool_use" && b.type !== "tool_result") };
    })
    .filter((m) => !m || !Array.isArray(m.content) || m.content.length > 0);
}

// Run one chat turn (stateless): takes the full message history, returns the
// assistant's reply plus the updated history. Same behavior locally and serverless.
// `agent` lets one deploy serve multiple personas per request; defaults to the
// deploy's active agent so existing callers are unchanged.
export async function runChat(incomingMessages, agent = AGENT) {
  const messages = stripClientToolTurns(Array.isArray(incomingMessages) ? incomingMessages : []);
  let bookingsUsed = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: agent.systemPrompt,
      tools: agent.tools,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        let result;
        if (isBookingTool(block.name)) {
          if (bookingsUsed >= 1) {
            result = "A booking was already submitted for this conversation. The team will follow up, so do not book again.";
          } else {
            bookingsUsed++;
            result = await agent.runTool(block.name, block.input);
          }
        } else {
          result = await agent.runTool(block.name, block.input);
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    messages.push({ role: "assistant", content: response.content });
    return { reply, messages };
  }

  // Hit the tool-round cap — bail out gracefully rather than loop forever.
  return {
    reply: "Let me get a teammate to follow up so we don't keep you waiting — what's the best email or phone to reach you?",
    messages,
  };
}
