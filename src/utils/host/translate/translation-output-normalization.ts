import type { ProviderConfig } from "@/types/config/provider"
import { decodeHTMLStrict } from "entities"

// Google and Microsoft both parse the request as HTML, so their adapters
// escape plain source text before sending and the response stays
// HTML-encoded; decode it exactly once here.
const HTML_ENCODED_OUTPUT_PROVIDERS = new Set(["google-translate", "microsoft-translate"])

export function normalizeTranslationOutput(
  providerConfig: Pick<ProviderConfig, "provider">,
  text: string,
): string {
  return HTML_ENCODED_OUTPUT_PROVIDERS.has(providerConfig.provider) ? decodeHTMLStrict(text) : text
}
