// ============= Google Gemini API =============

import { fetch } from "@tauri-apps/plugin-http";
import type { AiPrompt, AiReply } from "./types";

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export async function callGemini(
  prompt: AiPrompt,
  apiKey: string,
  model: string,
  signal?: AbortSignal,
): Promise<AiReply> {
  const url = `${GEMINI_MODELS_URL}/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ parts: [{ text: prompt.user }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }
  const data = await response.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "",
    model: typeof data.modelVersion === "string" ? data.modelVersion : undefined,
  };
}
