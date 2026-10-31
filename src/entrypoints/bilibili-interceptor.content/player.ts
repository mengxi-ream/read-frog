import type { BilibiliSubtitlesResponse } from "@/utils/subtitles/fetchers/bilibili"
import {
  BILIBILI_PAGE_POLL_INTERVAL_MS,
  BILIBILI_PAGE_WAIT_TIMEOUT_MS,
  BILIBILI_PLAYER_INFO_REFETCH_TIMEOUT_MS,
  BILIBILI_PLAYER_INFO_URL_PATTERN,
  BILIBILI_SUBTITLES_REQUEST_TYPE,
  BILIBILI_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { pollUntil } from "@/utils/poll"
import { findCapturedSubtitles, recordPlayerInfo } from "./player-info-capture"

function emptyResponse(requestId: string): BilibiliSubtitlesResponse {
  return { type: BILIBILI_SUBTITLES_RESPONSE_TYPE, requestId, cid: null, subtitles: null }
}

// The url can name the next part before the player has switched to it, so wait for both to agree.
function findPartCid(partId: string): number | null {
  try {
    const manifest = (window as any).player.getManifest()
    const playing = [`${manifest.bvid}:${manifest.p}`, `av${manifest.aid}:${manifest.p}`]
    return typeof manifest.cid === "number" && playing.includes(partId) ? manifest.cid : null
  } catch {
    return null
  }
}

// For a page script injected after the player asked, as on a Firefox update or a dev reload: the
// player's signed url is still in the resource timeline, and asking it again answers for this part.
async function refetchSubtitles(cid: number): Promise<unknown[] | null> {
  const signedUrl = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .findLast(
      (url) =>
        BILIBILI_PLAYER_INFO_URL_PATTERN.test(url) &&
        new URL(url).searchParams.get("cid") === String(cid),
    )
  if (!signedUrl) return null

  try {
    const response = await fetch(signedUrl, {
      credentials: "include",
      signal: AbortSignal.timeout(BILIBILI_PLAYER_INFO_REFETCH_TIMEOUT_MS),
    })
    recordPlayerInfo(await response.json())
  } catch {
    return null
  }
  return findCapturedSubtitles(cid)
}

function untilDeadline(deadline: number) {
  return { timeoutMs: deadline - Date.now(), intervalMs: BILIBILI_PAGE_POLL_INTERVAL_MS }
}

async function handleRequest(
  requestId: string,
  partId: string,
): Promise<BilibiliSubtitlesResponse> {
  const deadline = Date.now() + BILIBILI_PAGE_WAIT_TIMEOUT_MS
  const cid = await pollUntil(() => findPartCid(partId), untilDeadline(deadline))
  if (cid === null) return emptyResponse(requestId)

  const subtitles =
    (await pollUntil(() => findCapturedSubtitles(cid), untilDeadline(deadline))) ??
    (await refetchSubtitles(cid))
  return { type: BILIBILI_SUBTITLES_RESPONSE_TYPE, requestId, cid, subtitles }
}

export function listenForSubtitlesRequests(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (
      event.origin !== window.location.origin ||
      event.data?.type !== BILIBILI_SUBTITLES_REQUEST_TYPE
    ) {
      return
    }
    const { requestId, partId } = event.data
    // Answers even when something unexpected throws, so the content script never waits in vain.
    void handleRequest(requestId, partId)
      .catch(() => emptyResponse(requestId))
      .then((response) => window.postMessage(response, window.location.origin))
  })
}
