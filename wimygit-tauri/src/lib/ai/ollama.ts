// ============= Ollama (local server) =============

import { fetch } from "@tauri-apps/plugin-http";
import type { AiPrompt, AiReply } from "./types";

// Ollama's default context (2-4k tokens) silently drops the start of a long
// prompt; this fits the provider's 20,000-char diff limit plus instructions.
const OLLAMA_NUM_CTX = 16_384;

// The HTTP capability only allows loopback addresses, so reject other hosts
// here with a clear message instead of an opaque scope error.
// (IPv6 "[::1]" is left out: the scope's URL pattern syntax rejects brackets.)
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

function checkLocalUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid Ollama server URL: ${baseUrl}`);
  }
  if (url.protocol !== "http:" || !LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(
      `Ollama server URL must be http://localhost (or 127.0.0.1): ${baseUrl}`,
    );
  }
  return url;
}

export async function callOllama(
  prompt: AiPrompt,
  baseUrl: string,
  model: string,
  signal?: AbortSignal,
): Promise<AiReply> {
  const url = new URL("api/chat", checkLocalUrl(baseUrl).href.replace(/\/?$/, "/"));
  let response: Response;
  try {
    response = await fetch(url.href, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        options: { num_ctx: OLLAMA_NUM_CTX },
      }),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(
      `Could not connect to Ollama at ${baseUrl}. Is "ollama serve" running? (${e})`,
    );
  }
  if (!response.ok) {
    const err = await response.text();
    const hint = response.status === 404 ? ` Run "ollama pull ${model}" first.` : "";
    throw new Error(`Ollama error: ${response.status} ${err}${hint}`);
  }
  const data = await response.json();
  return {
    text: data.message?.content?.trim() ?? "",
    model: typeof data.model === "string" ? data.model : undefined,
  };
}
