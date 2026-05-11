import type { ProviderConfig } from "@/types/config/provider"
import { decodeHTML } from "entities"

export function normalizeTranslationOutput(providerConfig: Pick<ProviderConfig, "provider">, text: string): string {
  return providerConfig.provider === "google-translate"
    ? decodeHTML(text)
    : text
}
