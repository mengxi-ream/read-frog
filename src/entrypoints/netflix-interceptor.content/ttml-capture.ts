import { NETFLIX_TTML_URL_PATTERN } from "@/utils/constants/subtitles"

type Downloadables = Record<string, { urls?: Array<{ url?: string }> }>

// A TTML file does not say which episode or track it belongs to, so its download URL is the key.
const trackKeyByUrl = new Map<string, string>()
const ttmlByTrackKey = new Map<string, string>()

// Manifest v4 uses textTracks/downloadables; older ones use timedtexttracks/ttDownloadables.
function recordManifest(value: any): void {
  const manifest = value?.result
  const tracks = manifest?.textTracks ?? manifest?.timedtexttracks
  if (typeof manifest?.movieId !== "number" || !Array.isArray(tracks)) return

  for (const track of tracks) {
    const downloadables: Downloadables = track.downloadables ?? track.ttDownloadables ?? {}
    for (const { urls } of Object.values(downloadables)) {
      for (const { url } of urls ?? []) {
        if (url) trackKeyByUrl.set(url, `${manifest.movieId}:${track.id}`)
      }
    }
  }
}

export function setupTtmlCapture(): void {
  // Observe only: Netflix gets its value back untouched, and our errors never reach it.
  const originalParse = JSON.parse
  JSON.parse = function (...args: Parameters<typeof JSON.parse>) {
    const value = originalParse.apply(this, args)
    try {
      recordManifest(value)
    } catch {}
    return value
  }

  // Reflect.get/apply behave like `.open` and `.apply`; they only satisfy unbound-method and tuple typing.
  const originalOpen = Reflect.get(XMLHttpRequest.prototype, "open")
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
    const url = String(args[1])
    if (NETFLIX_TTML_URL_PATTERN.test(url)) {
      this.addEventListener("load", () => {
        // Unmapped files are dropped rather than guessed, so a prefetched next episode is never mistaken for this one.
        const trackKey = trackKeyByUrl.get(url)
        if (trackKey && this.status === 200 && typeof this.response === "string") {
          ttmlByTrackKey.set(trackKey, this.response)
        }
      })
    }
    return Reflect.apply(originalOpen, this, args)
  } as typeof XMLHttpRequest.prototype.open
}

export function findCapturedTtml(movieId: number, trackId: string): string | null {
  return ttmlByTrackKey.get(`${movieId}:${trackId}`) ?? null
}
