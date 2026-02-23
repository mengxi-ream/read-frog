import {
  EDGE_TTS_CIRCUIT_FAILURE_THRESHOLD,
  EDGE_TTS_CIRCUIT_OPEN_MS,
  EDGE_TTS_CIRCUIT_WINDOW_MS,
} from './constants'

const failureTimestamps: number[] = []
let circuitOpenUntil: number | null = null

function pruneOldFailures(now: number): void {
  const threshold = now - EDGE_TTS_CIRCUIT_WINDOW_MS
  while (failureTimestamps.length > 0 && failureTimestamps[0]! < threshold) {
    failureTimestamps.shift()
  }
}

export function isEdgeTTSCircuitOpen(now = Date.now()): boolean {
  return Boolean(circuitOpenUntil && circuitOpenUntil > now)
}

export function getEdgeTTSCircuitOpenUntil(): number | null {
  return circuitOpenUntil
}

export function recordEdgeTTSSuccess(): void {
  failureTimestamps.length = 0
  circuitOpenUntil = null
}

export function recordEdgeTTSFailure(now = Date.now()): void {
  pruneOldFailures(now)
  failureTimestamps.push(now)

  if (failureTimestamps.length >= EDGE_TTS_CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = now + EDGE_TTS_CIRCUIT_OPEN_MS
    failureTimestamps.length = 0
  }
}

export function resetEdgeTTSCircuitBreaker(): void {
  failureTimestamps.length = 0
  circuitOpenUntil = null
}
