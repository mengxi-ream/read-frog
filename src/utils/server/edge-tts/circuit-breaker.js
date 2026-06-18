import { EDGE_TTS_CIRCUIT_FAILURE_THRESHOLD, EDGE_TTS_CIRCUIT_OPEN_MS, EDGE_TTS_CIRCUIT_WINDOW_MS, } from "./constants";
const failureTimestamps = [];
let circuitOpenUntil = null;
function pruneOldFailures(now) {
    const threshold = now - EDGE_TTS_CIRCUIT_WINDOW_MS;
    while (failureTimestamps.length > 0 && failureTimestamps[0] < threshold) {
        failureTimestamps.shift();
    }
}
export function isEdgeTTSCircuitOpen(now = Date.now()) {
    return Boolean(circuitOpenUntil && circuitOpenUntil > now);
}
export function getEdgeTTSCircuitOpenUntil() {
    return circuitOpenUntil;
}
export function recordEdgeTTSSuccess() {
    failureTimestamps.length = 0;
    circuitOpenUntil = null;
}
export function recordEdgeTTSFailure(now = Date.now()) {
    pruneOldFailures(now);
    failureTimestamps.push(now);
    if (failureTimestamps.length >= EDGE_TTS_CIRCUIT_FAILURE_THRESHOLD) {
        circuitOpenUntil = now + EDGE_TTS_CIRCUIT_OPEN_MS;
        failureTimestamps.length = 0;
    }
}
export function resetEdgeTTSCircuitBreaker() {
    failureTimestamps.length = 0;
    circuitOpenUntil = null;
}
