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
// lead bot, switch to "claude-sonnet-4-6" (cheaper) or "claude-haiku-4-5".
const MODEL = "claude-opus-4-8";

// The active agent for this deploy.
export const AGENT = getActiveAgent();

// Client-safe config for the /config endpoint (used by the widget for branding).
export const CONFIG = publicConfig(AGENT);

// Cap on tool-use rounds in one turn — a backstop against a runaway loop.
const MAX_TOOL_ROUNDS = 6;

// Run one chat turn (stateless): takes the full message history, returns the
// assistant's reply plus the updated history. Same behavior locally and serverless.
export async function runChat(incomingMessages) {
  const messages = Array.isArray(incomingMessages) ? incomingMessages : [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: AGENT.systemPrompt,
      tools: AGENT.tools,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = await AGENT.runTool(block.name, block.input);
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
