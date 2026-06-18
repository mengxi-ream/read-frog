import { EDGE_TTS_USER_AGENT, EDGE_TTS_VOICES_CACHE_TTL_MS, getEdgeTTSVoicesUrl } from "./constants";
import { EdgeTTSError } from "./errors";
let voicesCache = null;
function isVoiceCacheValid(now = Date.now()) {
    if (!voicesCache) {
        return false;
    }
    return now - voicesCache.cachedAt < EDGE_TTS_VOICES_CACHE_TTL_MS;
}
export async function listEdgeTTSVoices() {
    if (isVoiceCacheValid()) {
        return voicesCache.voices;
    }
    try {
        const response = await fetch(getEdgeTTSVoicesUrl(), {
            headers: {
                "User-Agent": EDGE_TTS_USER_AGENT,
            },
        });
        if (!response.ok) {
            throw new EdgeTTSError("VOICES_FETCH_FAILED", `Failed to fetch voices: ${response.status}`, {
                status: response.status,
                retryable: response.status >= 500,
            });
        }
        const voices = await response.json();
        if (!Array.isArray(voices)) {
            throw new EdgeTTSError("VOICES_FETCH_FAILED", "Voices response is not an array");
        }
        voicesCache = {
            voices: voices,
            cachedAt: Date.now(),
        };
        return voicesCache.voices;
    }
    catch (error) {
        if (voicesCache) {
            return voicesCache.voices;
        }
        if (error instanceof EdgeTTSError) {
            throw error;
        }
        throw new EdgeTTSError("VOICES_FETCH_FAILED", "Failed to fetch Edge TTS voices", {
            cause: error,
            retryable: true,
        });
    }
}
export function clearEdgeTTSVoicesCache() {
    voicesCache = null;
}
export function filterEdgeTTSVoicesByLocale(voices, locale) {
    return voices.filter(voice => voice.Locale === locale || voice.Locale.startsWith(locale));
}
