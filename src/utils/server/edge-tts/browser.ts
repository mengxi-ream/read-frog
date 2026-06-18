import { EDGE_TTS_HTTP_ENABLED, EDGE_TTS_SUPPORTED_BROWSERS } from "./constants"
import { EdgeTTSError } from "./errors"

interface ChromeLike {
  offscreen?: {
    createDocument?: unknown
  }
}

function hasChromeOffscreenApi(): boolean {
  const chromeApi = (globalThis as { chrome?: ChromeLike }).chrome
  return typeof chromeApi?.offscreen?.createDocument === "function"
}

export function isEdgeTTSBrowserSupported(): boolean {
  return hasChromeOffscreenApi()
    || (EDGE_TTS_SUPPORTED_BROWSERS as readonly string[]).includes(import.meta.env.BROWSER)
}

export function assertEdgeTTSAvailable(): void {
  if (!EDGE_TTS_HTTP_ENABLED) {
    throw new EdgeTTSError("FEATURE_DISABLED", "Edge TTS HTTP route is disabled by feature flag")
  }

  if (!isEdgeTTSBrowserSupported()) {
    throw new EdgeTTSError(
      "UNSUPPORTED_BROWSER",
      `Edge TTS is not supported in ${import.meta.env.BROWSER}`,
    )
  }
}
