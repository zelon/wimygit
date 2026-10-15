// ============= Anthropic Claude API =============

import { fetch } from "@tauri-apps/plugin-http";
import type { AiReply } from "./types";

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MAX_TOKENS = 4096;

export async function callClaude(
  prompt: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<AiReply> {
  const response = await fetch(CLAUDE_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // plugin-http forwards the webview's Origin header, so the API treats
      // this as a browser (CORS) request and rejects it without this opt-in.
      // The key is the user's own and never leaves their machine otherwise.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: CLAUDE_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }
  const data = await response.json();
  const blocks: unknown[] = Array.isArray(data.content) ? data.content : [];
  const text = blocks
    .filter(
      (b): b is { type: "text"; text: string } =>
        !!b && (b as { type?: unknown }).type === "text",
    )
    .map((b) => b.text)
    .join("")
    .trim();
  return { text, model: typeof data.model === "string" ? data.model : undefined };
}
