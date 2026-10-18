// ============= Shared AI provider types =============

/**
 * A request split into fixed instructions (`system`) and the untrusted data
 * they apply to (`user`), so content inside a diff is not taken as instructions.
 */
export interface AiPrompt {
  system: string;
  user: string;
}

/** A provider's reply: the text plus the model that actually produced it. */
export interface AiReply {
  text: string;
  /** Model name reported by the response, if any (may differ from the requested one). */
  model?: string;
}
