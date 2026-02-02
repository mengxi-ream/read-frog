import type { AudioCaptionTrack, CaptionTrack, PlayerData } from './types'

export interface PotToken {
  pot: string | null
  potc: string | null
}

export function extractPotToken(
  selectedTrack: CaptionTrack,
  playerData: PlayerData,
): PotToken {
  const { audioCaptionTracks } = playerData

  if (!audioCaptionTracks.length)
    return { pot: null, potc: null }

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

  if (!matchedTrack && audioCaptionTracks.length > 0) {
    matchedTrack = audioCaptionTracks[0]
  }

  if (matchedTrack?.url) {
    try {
      const url = new URL(matchedTrack.url)
      return {
        pot: url.searchParams.get('pot'),
        potc: url.searchParams.get('potc'),
      }
    }
    catch {}
  }

  return { pot: null, potc: null }
}
