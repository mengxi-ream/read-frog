import { BILIBILI_PLAYER_INFO_URL_PATTERN } from "@/utils/constants/subtitles"

// One entry per part the player asked for, keyed by cid; the content script validates it.
const subtitlesByCid = new Map<number, unknown[]>()

export function recordPlayerInfo(value: any): void {
  const data = value?.data
  if (typeof data?.cid !== "number" || !Array.isArray(data.subtitle?.subtitles)) return

  subtitlesByCid.set(data.cid, data.subtitle.subtitles)
}

export function setupPlayerInfoCapture(): void {
  // Observe only: the player gets its response untouched, and our errors never reach it.
  const originalOpen = Reflect.get(XMLHttpRequest.prototype, "open")
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
    if (BILIBILI_PLAYER_INFO_URL_PATTERN.test(String(args[1]))) {
      this.addEventListener("load", () => {
        try {
          recordPlayerInfo(
            typeof this.response === "string" ? JSON.parse(this.response) : this.response,
          )
        } catch {}
      })
    }
    return Reflect.apply(originalOpen, this, args)
  } as typeof XMLHttpRequest.prototype.open
}

export function findCapturedSubtitles(cid: number): unknown[] | null {
  return subtitlesByCid.get(cid) ?? null
}
