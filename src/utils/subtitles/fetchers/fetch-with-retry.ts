import { TRACK_FETCH_ATTEMPTS, TRACK_FETCH_RETRY_DELAY_MS } from "@/utils/constants/subtitles"
import { sleep } from "@/utils/sleep"

/** Fetches, asking again after a request that fails outright or a 5xx; null if none got through. */
export async function fetchWithRetry(url: URL | string): Promise<Response | null> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url).catch(() => null)
    if ((response && response.status < 500) || attempt === TRACK_FETCH_ATTEMPTS) return response
    await sleep(TRACK_FETCH_RETRY_DELAY_MS)
  }
}

/** The body of an ok response, or null for no response or a body that is not JSON. */
export async function readJson(response: Response | null): Promise<unknown> {
  return response?.ok ? response.json().catch(() => null) : null
}
