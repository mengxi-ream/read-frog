import type { BilibiliSubtitlesResponse } from "@/utils/subtitles/fetchers/bilibili"
import type {
  BilibiliPlayingPart,
  BilibiliPlayingPartResponse,
} from "@/utils/subtitles/fetchers/bilibili/playing-part"
import {
  BILIBILI_PAGE_POLL_INTERVAL_MS,
  BILIBILI_PAGE_WAIT_TIMEOUT_MS,
  BILIBILI_PLAYER_INFO_REFETCH_TIMEOUT_MS,
  BILIBILI_PLAYER_INFO_URL_PATTERN,
  BILIBILI_PLAYING_PART_REQUEST_TYPE,
  BILIBILI_PLAYING_PART_RESPONSE_TYPE,
  BILIBILI_SUBTITLES_REQUEST_TYPE,
  BILIBILI_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { pollUntil } from "@/utils/poll"
import { findCapturedSubtitles, recordPlayerInfo } from "./player-info-capture"

function emptyResponse(requestId: string): BilibiliSubtitlesResponse {
  return { type: BILIBILI_SUBTITLES_RESPONSE_TYPE, requestId, cid: null, subtitles: null }
}

function playingPartResponse(
  requestId: string,
  part: BilibiliPlayingPart | null = null,
): BilibiliPlayingPartResponse {
  return { type: BILIBILI_PLAYING_PART_RESPONSE_TYPE, requestId, part }
}

// The url can name the next part before the player has switched to it, so wait for both to agree.
function findPlayingPart(partId: string): BilibiliPlayingPart | null {
  try {
    const manifest = (window as any).player.getManifest()
    const playing = [`${manifest.bvid}:${manifest.p}`, `av${manifest.aid}:${manifest.p}`]
    return typeof manifest.cid === "number" &&
      typeof manifest.bvid === "string" &&
      playing.includes(partId)
      ? { bvid: manifest.bvid, cid: manifest.cid }
      : null
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

async function handleSubtitlesRequest(
  requestId: string,
  partId: string,
): Promise<BilibiliSubtitlesResponse> {
  const deadline = Date.now() + BILIBILI_PAGE_WAIT_TIMEOUT_MS
  const part = await pollUntil(() => findPlayingPart(partId), untilDeadline(deadline))
  if (part === null) return emptyResponse(requestId)

  const { cid } = part
  const subtitles =
    (await pollUntil(() => findCapturedSubtitles(cid), untilDeadline(deadline))) ??
    (await refetchSubtitles(cid))
  return { type: BILIBILI_SUBTITLES_RESPONSE_TYPE, requestId, cid, subtitles }
}

async function handlePlayingPartRequest(
  requestId: string,
  partId: string,
): Promise<BilibiliPlayingPartResponse> {
  const deadline = Date.now() + BILIBILI_PAGE_WAIT_TIMEOUT_MS
  return playingPartResponse(
    requestId,
    await pollUntil(() => findPlayingPart(partId), untilDeadline(deadline)),
  )
}

function answerRequests<T>({
  requestType,
  handle,
  fallback,
}: {
  requestType: string
  handle: (requestId: string, partId: string) => Promise<T>
  fallback: (requestId: string) => T
}): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== requestType) {
      return
    }
    const { requestId, partId } = event.data
    // Answers even when something unexpected throws, so the content script never waits in vain.
    void handle(requestId, partId)
      .catch(() => fallback(requestId))
      .then((response) => window.postMessage(response, window.location.origin))
  })
}

export function listenForSubtitlesRequests(): void {
  answerRequests({
    requestType: BILIBILI_SUBTITLES_REQUEST_TYPE,
    handle: handleSubtitlesRequest,
    fallback: emptyResponse,
  })
  answerRequests({
    requestType: BILIBILI_PLAYING_PART_REQUEST_TYPE,
    handle: handlePlayingPartRequest,
    fallback: playingPartResponse,
  })
}
