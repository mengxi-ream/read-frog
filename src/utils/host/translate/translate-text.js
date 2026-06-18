import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions";
import { toast } from "sonner";
import { i18n } from "#imports";
import { isAPIProviderConfig, isLLMProviderConfig } from "@/types/config/provider";
import { getProviderConfigById } from "@/utils/config/helpers";
import { detectLanguage } from "@/utils/content/language";
import { logger } from "@/utils/logger";
import { getTranslatePrompt } from "@/utils/prompts/translate";
import { Sha256Hex } from "../../hash";
import { sendMessage } from "../../message";
import { prepareTranslationText } from "./text-preparation";
// Minimum text length for skip language detection (shorter than general detection
// to catch short phrases like "Bonjour!" or "こんにちは")
export const MIN_LENGTH_FOR_SKIP_LLM_DETECTION = 10;
/**
 * Check if text should be skipped based on language detection.
 * Uses LLM detection if enabled, falls back to franc library.
 * @param text - Text to detect language for
 * @param skipLanguages - List of languages to skip translation for
 * @param enableLLM - Whether to use LLM for language detection
 * @returns true if text language is in skipLanguages list (should skip translation)
 */
export async function shouldSkipByLanguage(text, skipLanguages, enableLLM) {
    const detectedLang = await detectLanguage(text, {
        minLength: MIN_LENGTH_FOR_SKIP_LLM_DETECTION,
        enableLLM,
    });
    if (!detectedLang) {
        return false;
    }
    return skipLanguages.includes(detectedLang);
}
export function normalizePromptContextValue(value) {
    if (value == null) {
        return value;
    }
    return value.trim() === "" ? null : value;
}
function normalizeWebPagePromptContext(webPageContext) {
    if (!webPageContext) {
        return undefined;
    }
    return {
        webTitle: normalizePromptContextValue(webPageContext.webTitle),
        webDescription: normalizePromptContextValue(webPageContext.webDescription),
        webContent: normalizePromptContextValue(webPageContext.webContent),
        webSummary: normalizePromptContextValue(webPageContext.webSummary),
    };
}
async function buildWebPageHashComponents(text, providerConfig, partialLangConfig, enableAIContentAware, webPageContext) {
    const preparedText = prepareTranslationText(text);
    const normalizedWebPageContext = normalizeWebPagePromptContext(webPageContext);
    const hashComponents = [
        preparedText,
        JSON.stringify(providerConfig),
        partialLangConfig.sourceCode,
        partialLangConfig.targetCode,
    ];
    if (!isLLMProviderConfig(providerConfig)) {
        return hashComponents;
    }
    const targetLangName = LANG_CODE_TO_EN_NAME[partialLangConfig.targetCode];
    const { systemPrompt, prompt } = await getTranslatePrompt(targetLangName, preparedText, {
        isBatch: true,
        context: normalizedWebPageContext,
    });
    hashComponents.push(systemPrompt, prompt);
    hashComponents.push(enableAIContentAware ? "enableAIContentAware=true" : "enableAIContentAware=false");
    if (enableAIContentAware && normalizedWebPageContext) {
        if (normalizedWebPageContext.webTitle) {
            hashComponents.push(`webTitle:${normalizedWebPageContext.webTitle}`);
        }
        if (normalizedWebPageContext.webDescription) {
            hashComponents.push(`webDescription:${normalizedWebPageContext.webDescription}`);
        }
        if (normalizedWebPageContext.webContent) {
            // Use a substring hash to avoid huge hash inputs while still differentiating contexts.
            hashComponents.push(`webContent:${normalizedWebPageContext.webContent.slice(0, 1000)}`);
        }
        if (normalizedWebPageContext.webSummary) {
            hashComponents.push(`webSummary:${normalizedWebPageContext.webSummary}`);
        }
    }
    return hashComponents;
}
/**
 * Core translation function — pure, zero config fetching.
 * All dependencies must be provided explicitly.
 */
export async function translateTextCore(options) {
    const { text, langConfig, providerConfig, enableAIContentAware = false, extraHashTags = [], webPageContext, } = options;
    const preparedText = prepareTranslationText(text);
    if (preparedText === "") {
        return "";
    }
    const normalizedWebPageContext = normalizeWebPagePromptContext(webPageContext);
    const hashComponents = await buildWebPageHashComponents(preparedText, providerConfig, { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode }, enableAIContentAware, normalizedWebPageContext);
    // Add extra hash tags for cache differentiation
    hashComponents.push(...extraHashTags);
    return await sendMessage("enqueueTranslateRequest", {
        text: preparedText,
        langConfig,
        providerConfig,
        scheduleAt: Date.now(),
        hash: Sha256Hex(...hashComponents),
        webTitle: normalizedWebPageContext?.webTitle,
        webDescription: normalizedWebPageContext?.webDescription,
        webContent: normalizedWebPageContext?.webContent,
        webSummary: normalizedWebPageContext?.webSummary,
    });
}
export function validateTranslationConfigAndToast(config) {
    const { providersConfig, translate: translateConfig, language: languageConfig } = config;
    const providerConfig = getProviderConfigById(providersConfig, translateConfig.providerId);
    if (!providerConfig) {
        return false;
    }
    if (languageConfig.sourceCode === languageConfig.targetCode) {
        toast.error(i18n.t("translation.sameLanguage"));
        logger.info("validateTranslationConfig: returning false (same language)");
        return false;
    }
    // check if the API key is configured
    if (isAPIProviderConfig(providerConfig) && !providerConfig.apiKey?.trim() && !["deeplx", "ollama"].includes(providerConfig.provider)) {
        toast.error(i18n.t("noAPIKeyConfig.warning"));
        logger.info("validateTranslationConfig: returning false (no API key)");
        return false;
    }
    return true;
}
