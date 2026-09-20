import { XCOM_PLAYER_CONTAINER_SELECTOR } from "@/utils/constants/subtitles"
import { getXcomStatusId, getXcomStatusIdFromUrl } from "@/utils/subtitles/video-id"

// Any control button's icon sits four levels below the controls group.
const XCOM_CONTROL_ICON_SELECTOR = 'button[role="button"] > div > svg'

const XCOM_VIDEO_CONTAINER_SELECTORS = [
  "[data-testid='videoPlayer']",
  "[data-testid='videoComponent']",
  "[data-testid='videoPlayerContainer']",
]

function hasRenderedSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function isCandidateStatusVideo(video: HTMLVideoElement): boolean {
  return (
    video.isConnected &&
    !video.closest("[aria-hidden='true']") &&
    !!getXcomStatusVideoContainer(video) &&
    !!video.closest("article")
  )
}

function belongsToStatus(video: HTMLVideoElement, statusId: string): boolean {
  const article = video.closest("article")
  if (!article) {
    return false
  }

  return Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href]")).some(
    (anchor) => getXcomStatusIdFromUrl(anchor.href) === statusId,
  )
}

function pickActiveCandidate(candidates: HTMLVideoElement[]): HTMLVideoElement | null {
  const visibleCandidates = candidates.filter(hasRenderedSize)

  return (
    visibleCandidates.find((video) => video.closest("[data-testid='videoComponent']:hover")) ??
    visibleCandidates.find((video) => video.closest(XCOM_PLAYER_CONTAINER_SELECTOR)) ??
    visibleCandidates.find((video) => !video.paused) ??
    pickSingleCandidate(candidates)
  )
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

export function findXcomControlsGroup(videoContainer: HTMLElement): HTMLElement | null {
  return (
    videoContainer.querySelector(XCOM_CONTROL_ICON_SELECTOR)?.parentElement?.parentElement
      ?.parentElement?.parentElement ?? null
  )
}

export function getCurrentPrimaryXcomStatusVideo(): HTMLVideoElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLVideoElement>("article video"),
  ).filter(isCandidateStatusVideo)
  const statusId = getXcomStatusId()
  const current = statusId ? candidates.filter((video) => belongsToStatus(video, statusId)) : []

  if (current.length > 0) {
    return pickSingleCandidate(current)
  }

  return pickActiveCandidate(candidates)
}

export function getXcomVideoStatusId(video: HTMLVideoElement): string | null {
  const article = video.closest("article")
  if (!article) {
    return null
  }

  for (const anchor of article.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const statusId = getXcomStatusIdFromUrl(anchor.href)
    if (statusId) {
      return statusId
    }
  }

  return null
}

// On a timeline the URL carries no status id, so read it off the active tweet.
export function getCurrentXcomVideoId(): string | null {
  const statusId = getXcomStatusId()
  if (statusId) {
    return statusId
  }

  const video = getCurrentXcomSubtitlesVideo()
  return video ? getXcomVideoStatusId(video) : null
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
