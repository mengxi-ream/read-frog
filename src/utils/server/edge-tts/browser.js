import { EDGE_TTS_HTTP_ENABLED, EDGE_TTS_SUPPORTED_BROWSERS } from "./constants";
import { EdgeTTSError } from "./errors";
export function isEdgeTTSBrowserSupported() {
    return EDGE_TTS_SUPPORTED_BROWSERS.includes(import.meta.env.BROWSER);
}
export function assertEdgeTTSAvailable() {
    if (!EDGE_TTS_HTTP_ENABLED) {
        throw new EdgeTTSError("FEATURE_DISABLED", "Edge TTS HTTP route is disabled by feature flag");
    }
    if (!isEdgeTTSBrowserSupported()) {
        throw new EdgeTTSError("UNSUPPORTED_BROWSER", `Edge TTS is not supported in ${import.meta.env.BROWSER}`);
    }
}
