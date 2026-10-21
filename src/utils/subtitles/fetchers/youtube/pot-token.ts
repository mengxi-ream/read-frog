import type { AudioCaptionTrack, CaptionTrack, PlayerData } from "./types"

export interface PotToken {
  pot: string | null
  potc: string | null
}

function getUrlVideoId(url: string): string | null | undefined {
  try {
    return new URL(url).searchParams.get("v")
  } catch {
    return undefined
  }
}

/**
 * A POT only works for the video it was minted for, and during a pre-roll ad the player's audio
 * track is the ad's. So a track lends its token only when it is the selected track or its URL
 * names this video, and never when its URL names another one.
 */
function findOwnAudioCaptionTrack(
  selectedTrack: CaptionTrack,
  playerData: PlayerData,
): AudioCaptionTrack | undefined {
  const { audioCaptionTracks, videoId } = playerData
  const candidates = audioCaptionTracks.filter((t) => {
    const trackVideoId = getUrlVideoId(t.url)
    return trackVideoId === null || trackVideoId === videoId
  })

  return (
    candidates.find((t) => t.vssId === selectedTrack.vssId) ??
    candidates.find(
      (t) => t.languageCode === selectedTrack.languageCode && t.kind === selectedTrack.kind,
    ) ??
    candidates.find((t) => getUrlVideoId(t.url) === videoId)
  )
}

export function extractPotToken(selectedTrack: CaptionTrack, playerData: PlayerData): PotToken {
  const { cachedTimedtextUrl } = playerData

  const matchedTrack = findOwnAudioCaptionTrack(selectedTrack, playerData)
  if (matchedTrack) {
    const url = new URL(matchedTrack.url)
    const pot = url.searchParams.get("pot")
    const potc = url.searchParams.get("potc")
    if (pot) {
      return { pot, potc }
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
