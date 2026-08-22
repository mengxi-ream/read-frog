import { XCOM_PLAYER_CONTAINER_SELECTOR } from "@/utils/constants/subtitles"

const XCOM_VIDEO_CONTAINER_SELECTORS = [
  "[data-testid='videoPlayer']",
  "[data-testid='videoComponent']",
  "[data-testid='videoPlayerContainer']",
]

function hasRenderedSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function isUsableXcomVideo(video: HTMLVideoElement): boolean {
  return (
    video.isConnected &&
    !video.closest("[aria-hidden='true']") &&
    !!getXcomStatusVideoContainer(video)
  )
}

function isCandidateStatusVideo(video: HTMLVideoElement): boolean {
  return isUsableXcomVideo(video) && !!video.closest("article")
}

function pickSingleCandidate(candidates: HTMLVideoElement[]): HTMLVideoElement | null {
  const visibleCandidates = candidates.filter(hasRenderedSize)

  if (visibleCandidates.length === 1) {
    return visibleCandidates[0] ?? null
  }

  if (visibleCandidates.length > 1) {
    return null
  }

  return candidates.length === 1 ? (candidates[0] ?? null) : null
}

export function getXcomStatusVideoContainer(video: HTMLVideoElement): HTMLElement | null {
  return (
    video.closest<HTMLElement>(XCOM_VIDEO_CONTAINER_SELECTORS.join(", ")) ?? video.parentElement
  )
}

export function getCurrentPrimaryXcomStatusVideo(): HTMLVideoElement | null {
  return pickSingleCandidate(
    Array.from(document.querySelectorAll<HTMLVideoElement>("article video")).filter(
      isCandidateStatusVideo,
    ),
  )
}

export function getReadFrogXcomStatusVideo(): HTMLVideoElement | null {
  return pickSingleCandidate(
    Array.from(
      document.querySelectorAll<HTMLVideoElement>(`${XCOM_PLAYER_CONTAINER_SELECTOR} video`),
    ).filter(isCandidateStatusVideo),
  )
}

export function getCurrentXcomSubtitlesVideo(): HTMLVideoElement | null {
  return getReadFrogXcomStatusVideo() ?? getCurrentPrimaryXcomStatusVideo()
}
