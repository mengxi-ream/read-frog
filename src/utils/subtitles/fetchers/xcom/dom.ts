import { XCOM_PLAYER_CONTAINER_SELECTOR } from "@/utils/constants/subtitles"
import { getXcomStatusId, getXcomStatusIdFromUrl } from "@/utils/subtitles/video-id"

const XCOM_VIDEO_CONTAINER_SELECTORS = [
  "[data-testid='videoPlayer']",
  "[data-testid='videoComponent']",
  "[data-testid='videoPlayerContainer']",
]

const XCOM_MEDIA_VIEWER_SELECTORS = [
  "[role='dialog']",
  "[aria-modal='true']",
]

function hasRenderedSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function isUsableXcomVideo(video: HTMLVideoElement): boolean {
  return video.isConnected
    && !video.closest("[aria-hidden='true']")
    && !!getXcomStatusVideoContainer(video)
}

function isCandidateStatusVideo(video: HTMLVideoElement): boolean {
  return isUsableXcomVideo(video) && !!video.closest("article")
}

function isMediaViewerVideo(video: HTMLVideoElement): boolean {
  return isUsableXcomVideo(video)
    && XCOM_MEDIA_VIEWER_SELECTORS.some(selector => !!video.closest(selector))
}

function articleMatchesStatusId(video: HTMLVideoElement, statusId: string): boolean {
  const article = video.closest("article")
  if (!article) {
    return false
  }

  return Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .some(anchor => getXcomStatusIdFromUrl(anchor.href) === statusId)
}

function articleHasAnyStatusId(video: HTMLVideoElement): boolean {
  const article = video.closest("article")
  if (!article) {
    return false
  }

  return Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .some(anchor => getXcomStatusIdFromUrl(anchor.href) !== null)
}

function preferCurrentStatusCandidates(
  candidates: HTMLVideoElement[],
  statusId: string | null,
): HTMLVideoElement[] {
  if (!statusId) {
    return candidates
  }

  const currentStatusCandidates = candidates.filter(video => articleMatchesStatusId(video, statusId))
  if (currentStatusCandidates.length > 0) {
    return currentStatusCandidates
  }

  const hasOnlyOtherStatusCandidates = candidates.length > 0
    && candidates.every(articleHasAnyStatusId)

  return hasOnlyOtherStatusCandidates ? [] : candidates
}

function getSingleCandidateVideo(candidates: HTMLVideoElement[]): HTMLVideoElement | null {
  const visibleCandidates = candidates.filter(hasRenderedSize)

  if (visibleCandidates.length === 1) {
    return visibleCandidates[0]
  }

  if (visibleCandidates.length > 1) {
    return null
  }

  return candidates.length === 1 ? candidates[0] : null
}

export function getCurrentPrimaryXcomStatusVideo(): HTMLVideoElement | null {
  const mediaViewerVideo = getSingleCandidateVideo(
    Array.from(document.querySelectorAll<HTMLVideoElement>(XCOM_MEDIA_VIEWER_SELECTORS.map(selector => `${selector} video`).join(", ")))
      .filter(isMediaViewerVideo),
  )
  if (mediaViewerVideo) {
    return mediaViewerVideo
  }

  const candidates = preferCurrentStatusCandidates(
    Array.from(document.querySelectorAll<HTMLVideoElement>("article video"))
      .filter(isCandidateStatusVideo),
    getXcomStatusId(),
  )

  return getSingleCandidateVideo(candidates)
}

export function getReadFrogXcomStatusVideo(): HTMLVideoElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLVideoElement>(`${XCOM_PLAYER_CONTAINER_SELECTOR} video`))
    .filter(isCandidateStatusVideo)

  const visibleCandidates = candidates.filter(hasRenderedSize)

  if (visibleCandidates.length === 1) {
    return visibleCandidates[0]
  }

  return candidates.length === 1 ? candidates[0] : null
}

export function getCurrentXcomSubtitlesVideo(): HTMLVideoElement | null {
  return getReadFrogXcomStatusVideo() ?? getCurrentPrimaryXcomStatusVideo()
}

export function getXcomStatusVideoContainer(video: HTMLVideoElement): HTMLElement | null {
  return video.closest<HTMLElement>(XCOM_VIDEO_CONTAINER_SELECTORS.join(", "))
    ?? video.parentElement
}
