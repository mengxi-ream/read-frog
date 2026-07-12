import type { ProviderConfig } from "@/types/config/provider"
import { decodeHTMLStrict } from "entities"

export function normalizeTranslationOutput(
  providerConfig: Pick<ProviderConfig, "provider">,
  text: string,
): string {
  return providerConfig.provider === "google-translate" ? decodeHTMLStrict(text) : text
}
