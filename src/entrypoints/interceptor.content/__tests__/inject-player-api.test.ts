// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ENSURE_SUBTITLES_REQUEST_TYPE,
  PLAYER_DATA_REQUEST_TYPE,
  PLAYER_RESPONSE_PENDING_ERROR,
} from "@/utils/constants/subtitles"
import { injectPlayerApi } from "../inject-player-api"

interface FakePlayerOptions {
  id: string
  mode: string
  videoId: string
  captionsPressed?: boolean
  // On the video already, but its player response has not arrived yet.
  responsePending?: boolean
}

function addPlayer({
  id,
  mode,
  videoId,
  captionsPressed = false,
  responsePending = false,
}: FakePlayerOptions) {
  const player = Object.assign(document.createElement("div"), {
    getVideoData: () => ({ video_id: videoId }),
    getPlayerResponse: () =>
      responsePending
        ? {}
        : {
            videoDetails: { videoId },
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ja&kind=asr`,
                    languageCode: "ja",
                    kind: "asr",
                    vssId: "a.ja",
                  },
                ],
              },
            },
          },
    getPlayerState: () => (responsePending ? 1 : -1),
    toggleSubtitles: vi.fn<() => void>(),
  })
  player.id = id
  player.className = `html5-video-player ${mode}`
  const button = document.createElement("button")
  button.className = "ytp-subtitles-button"
  button.setAttribute("aria-pressed", String(captionsPressed))
  player.append(button)
  document.body.append(player)
  return player
}

function ask(data: Record<string, unknown>) {
  const postMessage = vi.spyOn(window, "postMessage").mockImplementation(() => {})
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { requestId: "request-1", ...data },
      origin: window.location.origin,
    }),
  )
  const reply = postMessage.mock.calls[0]?.[0]
  postMessage.mockRestore()
  return reply
}

describe("injectPlayerApi player lookup", () => {
  beforeAll(() => {
    injectPlayerApi()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // A hovered thumbnail leaves its preview player paused on the page while the watch player
  // has not started yet, and the preview comes first in document order.
  it("answers from the watch player when a lingering preview holds another video", () => {
    addPlayer({ id: "inline-preview-player", mode: "paused-mode", videoId: "preview123" })
    addPlayer({ id: "movie_player", mode: "unstarted-mode", videoId: "SfcUVFzKRBY" })

    const reply = ask({ type: PLAYER_DATA_REQUEST_TYPE, expectedVideoId: "SfcUVFzKRBY" })

    expect(reply).toMatchObject({ success: true, data: { videoId: "SfcUVFzKRBY" } })
    expect(reply.data.captionTracks).toHaveLength(1)
    expect(reply.data.captionTracks[0].vssId).toBe("a.ja")
  })

  it("still reports a mismatch while no player holds the expected video", () => {
    addPlayer({ id: "inline-preview-player", mode: "paused-mode", videoId: "preview123" })
    addPlayer({ id: "movie_player", mode: "unstarted-mode", videoId: "previous456" })

    const reply = ask({ type: PLAYER_DATA_REQUEST_TYPE, expectedVideoId: "SfcUVFzKRBY" })

    expect(reply).toMatchObject({ success: false, error: "VIDEO_ID_MISMATCH" })
  })

  // With AdGuard on, a cold load fetches the player response again, and until it lands the
  // playing watch player is on our video while its response still says nothing.
  it("reports a watch player on our video whose response is still on the way as pending", () => {
    addPlayer({ id: "inline-preview-player", mode: "paused-mode", videoId: "preview123" })
    addPlayer({
      id: "movie_player",
      mode: "playing-mode",
      videoId: "SfcUVFzKRBY",
      responsePending: true,
    })

    const reply = ask({ type: PLAYER_DATA_REQUEST_TYPE, expectedVideoId: "SfcUVFzKRBY" })

    expect(reply).toMatchObject({ success: false, error: PLAYER_RESPONSE_PENDING_ERROR })
  })

  it("turns on captions in the watch player, not the preview", () => {
    const preview = addPlayer({
      id: "inline-preview-player",
      mode: "paused-mode",
      videoId: "preview123",
      captionsPressed: true,
    })
    const main = addPlayer({ id: "movie_player", mode: "unstarted-mode", videoId: "SfcUVFzKRBY" })

    ask({ type: ENSURE_SUBTITLES_REQUEST_TYPE, videoId: "SfcUVFzKRBY" })

    expect(main.toggleSubtitles).toHaveBeenCalledTimes(1)
    expect(preview.toggleSubtitles).not.toHaveBeenCalled()
  })
})
