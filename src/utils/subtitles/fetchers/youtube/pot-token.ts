import type { AudioCaptionTrack, CaptionTrack, PlayerData } from "./types"

export interface PotToken {
  pot: string | null
  potc: string | null
}

export function extractPotToken(
  selectedTrack: CaptionTrack,
  playerData: PlayerData,
): PotToken {
  const { audioCaptionTracks, cachedTimedtextUrl } = playerData

  if (audioCaptionTracks.length > 0) {
    let matchedTrack: AudioCaptionTrack | undefined = audioCaptionTracks.find(
      t => t.vssId === selectedTrack.vssId,
    )

    if (!matchedTrack) {
      matchedTrack = audioCaptionTracks.find(
        t => t.languageCode === selectedTrack.languageCode
          && t.kind === selectedTrack.kind,
      )
    }

    if (!matchedTrack) {
      matchedTrack = audioCaptionTracks.find(
        t => t.languageCode === selectedTrack.languageCode,
      )
    }

    if (!matchedTrack) {
      matchedTrack = audioCaptionTracks[0]
    }

    if (matchedTrack?.url) {
      const url = new URL(matchedTrack.url)
      const pot = url.searchParams.get("pot")
      const potc = url.searchParams.get("potc")
      if (pot) {
        return { pot, potc }
      }
    }
  }

  if (cachedTimedtextUrl) {
    const url = new URL(cachedTimedtextUrl)
    const pot = url.searchParams.get("pot")
    const potc = url.searchParams.get("potc")
    if (pot) {
      return { pot, potc }
    }
  }

  return { pot: null, potc: null }
}
