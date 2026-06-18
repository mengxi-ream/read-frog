/**
 * Edge TTS Token facade.
 * Kept for backward compatibility with existing imports.
 */
import { clearEdgeTTSTokenCache, getEdgeTTSEndpointToken } from "./endpoint";
export async function getEdgeTTSAccessToken() {
    const tokenInfo = await getEdgeTTSEndpointToken();
    return tokenInfo.token;
}
export async function getEdgeTTSEndpoint() {
    const tokenInfo = await getEdgeTTSEndpointToken();
    return `https://${tokenInfo.endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
}
export function clearEdgeTTSToken() {
    clearEdgeTTSTokenCache();
}
