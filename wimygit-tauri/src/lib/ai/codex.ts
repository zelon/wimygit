// ============= OpenAI Codex API (Responses API) =============

import { fetch } from "@tauri-apps/plugin-http";
import type { AiReply } from "./types";

const CODEX_URL = "https://api.openai.com/v1/responses";

interface ResponsesOutputItem {
  content?: { type?: string; text?: string }[];
}

export async function callCodex(
  prompt: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<AiReply> {
  const response = await fetch(CODEX_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: { format: { type: "json_object" } },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Codex API error: ${response.status} ${err}`);
  }
  const data = await response.json();
  const output: ResponsesOutputItem[] = Array.isArray(data.output) ? data.output : [];
  const text = output
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("")
    .trim();
  return { text, model: typeof data.model === "string" ? data.model : undefined };
}
