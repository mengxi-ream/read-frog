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

interface PartRequest {
  requestId: string
  partId: string
}

function emptyResponse(requestId: string): BilibiliSubtitlesResponse {
  return { type: BILIBILI_SUBTITLES_RESPONSE_TYPE, requestId, cid: null, subtitles: null }
}

function playingPartResponse({
  requestId,
  part,
}: {
  requestId: string
  part: BilibiliPlayingPart | null
}): BilibiliPlayingPartResponse {
  return { type: BILIBILI_PLAYING_PART_RESPONSE_TYPE, requestId, part }
}

/** The player's own account of what it plays; nothing while it is still starting. */
function readManifest(): Record<string, unknown> {
  try {
    return (window as any).player.getManifest() ?? {}
  } catch {
    return {}
  }
}

// The url can name the next part before the player has switched to it, so wait for both to agree.
function findPlayingPart(partId: string): BilibiliPlayingPart | null {
  const { bvid, aid, cid, p } = readManifest()
  return typeof bvid === "string" &&
    typeof aid === "number" &&
    typeof cid === "number" &&
    typeof p === "number" &&
    [`${bvid}:${p}`, `av${aid}:${p}`].includes(partId)
    ? { bvid, cid, p }
    : null
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

function waitForPlayingPart({ partId, deadline }: { partId: string; deadline: number }) {
  return pollUntil(() => findPlayingPart(partId), untilDeadline(deadline))
}

async function answerSubtitles({
  requestId,
  partId,
}: PartRequest): Promise<BilibiliSubtitlesResponse> {
  const deadline = Date.now() + BILIBILI_PAGE_WAIT_TIMEOUT_MS
  const part = await waitForPlayingPart({ partId, deadline })
  if (part === null) return emptyResponse(requestId)

  const { cid } = part
  const subtitles =
    (await pollUntil(() => findCapturedSubtitles(cid), untilDeadline(deadline))) ??
    (await refetchSubtitles(cid))
  return { type: BILIBILI_SUBTITLES_RESPONSE_TYPE, requestId, cid, subtitles }
}

async function answerPlayingPart({
  requestId,
  partId,
}: PartRequest): Promise<BilibiliPlayingPartResponse> {
  const deadline = Date.now() + BILIBILI_PAGE_WAIT_TIMEOUT_MS
  return playingPartResponse({ requestId, part: await waitForPlayingPart({ partId, deadline }) })
}

function answerRequests<T>({
  requestType,
  answer,
  fallback,
}: {
  requestType: string
  answer: (request: PartRequest) => Promise<T>
  fallback: (requestId: string) => T
}): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.data?.type !== requestType) {
      return
    }
    const { requestId, partId } = event.data
    // Answers even when something unexpected throws, so the content script never waits in vain.
    void answer({ requestId, partId })
      .catch(() => fallback(requestId))
      .then((response) => window.postMessage(response, window.location.origin))
  })
}

export function listenForSubtitlesRequests(): void {
  answerRequests({
    requestType: BILIBILI_SUBTITLES_REQUEST_TYPE,
    answer: answerSubtitles,
    fallback: emptyResponse,
  })
}

export function listenForPlayingPartRequests(): void {
  answerRequests({
    requestType: BILIBILI_PLAYING_PART_REQUEST_TYPE,
    answer: answerPlayingPart,
    fallback: (requestId) => playingPartResponse({ requestId, part: null }),
  })
}
