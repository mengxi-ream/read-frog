import { decodeHTML } from "entities";
export function normalizeTranslationOutput(providerConfig, text) {
    return providerConfig.provider === "google-translate"
        ? decodeHTML(text)
        : text;
}
