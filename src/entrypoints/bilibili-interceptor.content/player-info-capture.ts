import { BILIBILI_PLAYER_INFO_URL_PATTERN } from "@/utils/constants/subtitles"

export interface BilibiliPlayerInfo {
  needLogin: boolean
  /** Passed on as the player got it; the content script validates it. */
  subtitles: unknown[]
}

// The player asks for one part's info at a time and asks again on a part switch, so the cid is the key.
const playerInfoByCid = new Map<number, BilibiliPlayerInfo>()

export function recordPlayerInfo(value: any): void {
  const data = value?.data
  if (typeof data?.cid !== "number" || !Array.isArray(data.subtitle?.subtitles)) return

  playerInfoByCid.set(data.cid, {
    needLogin: data.need_login_subtitle === true,
    subtitles: data.subtitle.subtitles,
  })
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

export function findCapturedPlayerInfo(cid: number): BilibiliPlayerInfo | null {
  return playerInfoByCid.get(cid) ?? null
}
