import { APP_NAME } from "@read-frog/definitions";
import { env } from "@/env";
export const DEFAULT_PROVIDER_HEADERS = {
    anthropic: {
        "anthropic-dangerous-direct-browser-access": "true",
    },
    openrouter: {
        "HTTP-Referer": env.WXT_WEBSITE_URL,
        "X-OpenRouter-Title": APP_NAME,
    },
};
function compactStringRecord(record) {
    if (!record) {
        return undefined;
    }
    const compacted = Object.fromEntries(Object.entries(record).filter((entry) => {
        const [, value] = entry;
        return typeof value === "string" && value !== "";
    }));
    return Object.keys(compacted).length > 0 ? compacted : undefined;
}
export function getDefaultProviderHeaders(provider) {
    return compactStringRecord(DEFAULT_PROVIDER_HEADERS[provider]);
}
export function getProviderHeadersWithOverride(provider, userHeaders) {
    if (userHeaders !== undefined) {
        return compactStringRecord(userHeaders);
    }
    return getDefaultProviderHeaders(provider);
}
