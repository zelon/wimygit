// ============= Shared AI provider types =============

/** A provider's reply: the text plus the model that actually produced it. */
export interface AiReply {
  text: string;
  /** Model name reported by the response, if any (may differ from the requested one). */
  model?: string;
}
