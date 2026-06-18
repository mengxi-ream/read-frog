import { LANG_CODE_TO_EN_NAME } from "@read-frog/definitions";
import { APICallError } from "ai";
import { i18n } from "#imports";
import { isLLMProviderConfig } from "@/types/config/provider";
import { getProviderConfigById } from "@/utils/config/helpers";
import { getLocalConfig } from "@/utils/config/storage";
import { cleanText } from "@/utils/content/utils";
import { Sha256Hex } from "@/utils/hash";
import { prepareTranslationText } from "@/utils/host/translate/text-preparation";
import { normalizePromptContextValue } from "@/utils/host/translate/translate-text";
import { sendMessage } from "@/utils/message";
import { getSubtitlesTranslatePrompt } from "@/utils/prompts/subtitles";
function toFriendlyErrorMessage(error) {
    if (error instanceof APICallError) {
        switch (error.statusCode) {
            case 429:
                return i18n.t("subtitles.errors.aiRateLimited");
            case 401:
            case 403:
                return i18n.t("subtitles.errors.aiAuthFailed");
            case 500:
            case 502:
            case 503:
                return i18n.t("subtitles.errors.aiServiceUnavailable");
        }
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("No Response") || message.includes("Empty response")) {
        return i18n.t("subtitles.errors.aiNoResponse");
    }
    return message;
}
export function buildSubtitlesSummaryContextHash(videoContext, providerConfig) {
    const preparedText = cleanText(videoContext.subtitlesTextContent);
    if (!preparedText) {
        return undefined;
    }
    const textHash = Sha256Hex(preparedText);
    return Sha256Hex(textHash, providerConfig ? JSON.stringify(providerConfig) : "");
}
function normalizeSubtitlePromptContext(videoContext) {
    return {
        webTitle: normalizePromptContextValue(videoContext.videoTitle),
        webDescription: normalizePromptContextValue(videoContext.videoDescription),
        videoSummary: normalizePromptContextValue(videoContext.summary),
    };
}
async function buildSubtitleHashComponents(text, providerConfig, partialLangConfig, enableAIContentAware, subtitlePromptContext, subtitlesTextContent) {
    const preparedText = prepareTranslationText(text);
    const normalizedSubtitlesTextContent = normalizePromptContextValue(subtitlesTextContent);
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
    const promptContext = enableAIContentAware
        ? subtitlePromptContext
        : { ...subtitlePromptContext, videoSummary: undefined };
    const { systemPrompt, prompt } = await getSubtitlesTranslatePrompt(targetLangName, preparedText, {
        isBatch: true,
        context: promptContext,
    });
    hashComponents.push(systemPrompt, prompt);
    hashComponents.push(enableAIContentAware ? "enableAIContentAware=true" : "enableAIContentAware=false");
    if (subtitlePromptContext.webTitle) {
        hashComponents.push(`webTitle:${subtitlePromptContext.webTitle}`);
    }
    if (subtitlePromptContext.webDescription) {
        hashComponents.push(`webDescription:${subtitlePromptContext.webDescription}`);
    }
    if (enableAIContentAware) {
        if (normalizedSubtitlesTextContent) {
            hashComponents.push(`subtitlesTextContent:${normalizedSubtitlesTextContent.slice(0, 1000)}`);
        }
        if (subtitlePromptContext.videoSummary) {
            hashComponents.push(`videoSummary:${subtitlePromptContext.videoSummary}`);
        }
    }
    return hashComponents;
}
async function translateSingleSubtitle(text, langConfig, providerConfig, enableAIContentAware, videoContext) {
    const subtitlePromptContext = normalizeSubtitlePromptContext(videoContext);
    const hashComponents = await buildSubtitleHashComponents(text, providerConfig, { sourceCode: langConfig.sourceCode, targetCode: langConfig.targetCode }, enableAIContentAware, subtitlePromptContext, videoContext.subtitlesTextContent);
    if (enableAIContentAware) {
        const summary = subtitlePromptContext.videoSummary;
        hashComponents.push(summary ? "subtitleSummary=ready" : "subtitleSummary=missing");
    }
    return await sendMessage("enqueueSubtitlesTranslateRequest", {
        text,
        langConfig,
        providerConfig,
        scheduleAt: Date.now(),
        hash: Sha256Hex(...hashComponents),
        webTitle: subtitlePromptContext.webTitle,
        webDescription: subtitlePromptContext.webDescription,
        summary: enableAIContentAware ? subtitlePromptContext.videoSummary : undefined,
    });
}
export async function fetchSubtitlesSummary(videoContext, configOverride) {
    const config = configOverride ?? await getLocalConfig();
    if (!config?.translate.enableAIContentAware) {
        return null;
    }
    const providerConfig = getProviderConfigById(config.providersConfig, config.videoSubtitles.providerId);
    if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
        return null;
    }
    if (!videoContext.videoTitle || !videoContext.subtitlesTextContent) {
        return null;
    }
    return await sendMessage("getSubtitlesSummary", {
        videoTitle: videoContext.videoTitle,
        subtitlesContext: videoContext.subtitlesTextContent,
        providerConfig,
    });
}
export async function translateSubtitles(fragments, videoContext, configOverride) {
    const config = configOverride ?? await getLocalConfig();
    if (!config) {
        return fragments.map(f => ({ ...f, translation: "" }));
    }
    const providerConfig = getProviderConfigById(config.providersConfig, config.videoSubtitles.providerId);
    if (!providerConfig) {
        return fragments.map(f => ({ ...f, translation: "" }));
    }
    const langConfig = config.language;
    const enableAIContentAware = !!config.translate.enableAIContentAware;
    const translationPromises = fragments.map(fragment => translateSingleSubtitle(fragment.text, langConfig, providerConfig, enableAIContentAware, videoContext));
    const results = await Promise.allSettled(translationPromises);
    // If all translations failed, throw with friendly error message
    const allRejected = results.every((r) => r.status === "rejected");
    if (allRejected && results.length) {
        throw new Error(toFriendlyErrorMessage(results[0].reason));
    }
    return fragments.map((fragment, index) => {
        const result = results[index];
        return {
            ...fragment,
            translation: result.status === "fulfilled" ? result.value : "",
        };
    });
}
