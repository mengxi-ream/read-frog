/**
 * Edge TTS Token facade.
 * Kept for backward compatibility with existing imports.
 */

import { clearEdgeTTSTokenCache, getEdgeTTSEndpointToken } from './endpoint'

export async function getEdgeTTSAccessToken(): Promise<string> {
  const tokenInfo = await getEdgeTTSEndpointToken()
  return tokenInfo.token
}

export async function getEdgeTTSEndpoint(): Promise<string> {
  const tokenInfo = await getEdgeTTSEndpointToken()
  return `https://${tokenInfo.endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`
}

export function clearEdgeTTSToken(): void {
  clearEdgeTTSTokenCache()
}
