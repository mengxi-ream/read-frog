import { sendMessage } from "@/utils/message";
export async function deeplTranslate(sourceText, fromLang, toLang, providerConfig, options) {
    const [translatedText] = await requestDeepLTranslations([sourceText], fromLang, toLang, providerConfig, options);
    if (translatedText === undefined) {
        throw new Error("DeepL translation response did not include a result");
    }
    return translatedText;
}
async function requestDeepLTranslations(sourceTexts, fromLang, toLang, providerConfig, options) {
    const apiKey = providerConfig.apiKey?.trim();
    if (!apiKey) {
        throw new Error("DeepL API key is not configured");
    }
    const baseURL = getDeepLBaseURL(apiKey);
    const url = `${baseURL}/v2/translate`;
    const normalizedLanguages = normalizeDeepLLanguages(fromLang, toLang);
    const requestBody = JSON.stringify({
        text: sourceTexts,
        ...(normalizedLanguages.source ? { source_lang: normalizedLanguages.source } : {}),
        target_lang: normalizedLanguages.target,
    });
    const fetchResponse = shouldUseBackgroundFetch(options)
        ? await fetchViaBackground(url, apiKey, requestBody)
        : await fetchDirect(url, apiKey, requestBody);
    return await parseDeepLResponse(fetchResponse, sourceTexts.length);
}
function shouldUseBackgroundFetch(options) {
    return options?.forceBackgroundFetch ?? typeof window !== "undefined";
}
async function fetchViaBackground(url, apiKey, body) {
    const resp = await sendMessage("backgroundFetch", {
        url,
        method: "POST",
        headers: [
            ["Authorization", `DeepL-Auth-Key ${apiKey}`],
            ["Content-Type", "application/json"],
        ],
        body,
        credentials: "omit",
    });
    return {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        statusText: resp.statusText,
        text: () => Promise.resolve(resp.body),
        json: () => Promise.resolve(JSON.parse(resp.body)),
    };
}
async function fetchDirect(url, apiKey, body) {
    const resp = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `DeepL-Auth-Key ${apiKey}`,
            "Content-Type": "application/json",
        },
        body,
    }).catch((error) => {
        throw new Error(`Network error during DeepL translation: ${error.message}`);
    });
    return resp;
}
async function parseDeepLResponse(resp, expectedCount) {
    if (!resp.ok) {
        const errorText = await resp.text().catch(() => "Unable to read error response");
        throw new Error(`DeepL translation request failed: ${resp.status} ${resp.statusText}${errorText ? ` - ${errorText}` : ""}`);
    }
    try {
        const result = await resp.json();
        const translations = result?.translations;
        if (!Array.isArray(translations)) {
            throw new TypeError("Unexpected response format from DeepL translation API");
        }
        if (translations.length !== expectedCount) {
            throw new RangeError(`DeepL translation response count mismatch: expected ${expectedCount}, got ${translations.length}`);
        }
        return translations.map((translation, index) => {
            if (typeof translation?.text !== "string") {
                throw new TypeError(`Unexpected translation format at index ${index}`);
            }
            return translation.text;
        });
    }
    catch (error) {
        throw new Error(`Failed to parse DeepL translation response: ${error.message}`);
    }
}
export function getDeepLBaseURL(apiKey) {
    return apiKey.endsWith(":fx")
        ? "https://api-free.deepl.com"
        : "https://api.deepl.com";
}
export function normalizeDeepLLanguages(fromLang, toLang) {
    return {
        source: fromLang === "auto" ? undefined : formatDeepLLanguageCode(fromLang, "source"),
        target: formatDeepLLanguageCode(toLang, "target"),
    };
}
function formatDeepLLanguageCode(lang, direction) {
    const formattedLang = lang.toUpperCase();
    if (formattedLang === "ZH") {
        return direction === "target" ? "ZH-HANS" : "ZH";
    }
    if (formattedLang === "ZH-TW") {
        return direction === "target" ? "ZH-HANT" : "ZH";
    }
    return formattedLang;
}
