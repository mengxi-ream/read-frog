import { XCOM_PLAYER_CONTAINER_SELECTOR } from "@/utils/constants/subtitles"
import { getXcomStatusId, getXcomStatusIdFromUrl } from "@/utils/subtitles/video-id"

// Any control button's icon sits four levels below the controls group.
const XCOM_CONTROL_ICON_SELECTOR = 'button[role="button"] > div > svg'

const XCOM_PROGRESS_SLIDER_SELECTOR = '[role="slider"]'

const XCOM_VIDEO_CONTAINER_SELECTORS = [
  "[data-testid='videoPlayer']",
  "[data-testid='videoComponent']",
  "[data-testid='videoPlayerContainer']",
]

// X hides a card's media from screen readers, yet plays a broadcast replay there.
const XCOM_HIDDEN_ANCESTOR_SELECTOR =
  "[aria-hidden='true']:not([data-testid='card.layoutLarge.media'])"

// X's media view: a post's media as slides in a dialog over the page, with no article.
const XCOM_MEDIA_VIEW_SELECTOR = "[role='dialog'][aria-modal='true']"

function hasRenderedSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

// The media view keeps the slides it does not show mounted beside the screen, paused;
// going by the center, only one slide counts mid-swipe.
function isCenteredOnScreen(element: HTMLElement): boolean {
  const { left, width } = element.getBoundingClientRect()
  const center = left + width / 2
  return center >= 0 && center <= window.innerWidth
}

// The URL names the media view's post, though not always which of its media is shown.
function getMediaViewStatusId(video: HTMLVideoElement): string | null {
  return video.closest(XCOM_MEDIA_VIEW_SELECTOR) ? getXcomStatusId() : null
}

function isCandidateStatusVideo(video: HTMLVideoElement): boolean {
  return (
    video.isConnected &&
    !video.closest(XCOM_HIDDEN_ANCESTOR_SELECTOR) &&
    !!getXcomStatusVideoContainer(video) &&
    (!!video.closest("article") || (!!getMediaViewStatusId(video) && isCenteredOnScreen(video)))
  )
}

function belongsToStatus(video: HTMLVideoElement, statusId: string): boolean {
  const article = video.closest("article")
  if (!article) {
    return getMediaViewStatusId(video) === statusId
  }

  return Array.from(article.querySelectorAll<HTMLAnchorElement>("a[href]")).some(
    (anchor) => getXcomStatusIdFromUrl(anchor.href) === statusId,
  )
}

// `preferred` is the video the URL names, which only wins while the reader has not
// singled another one out: replies and quotes carry videos of their own.
function pickActiveCandidate(
  candidates: HTMLVideoElement[],
  preferred: HTMLVideoElement[],
): HTMLVideoElement | null {
  const rendered = candidates.filter(hasRenderedSize)

  return (
    rendered.find((video) => video.closest("[data-testid='videoComponent']:hover")) ??
    rendered.find((video) => video.closest(XCOM_PLAYER_CONTAINER_SELECTOR)) ??
    pickSingleCandidate(preferred) ??
    rendered.find((video) => !video.paused) ??
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
  if (!videoContainer.querySelector(XCOM_PROGRESS_SLIDER_SELECTOR)) {
    return null
  }

  return (
    videoContainer.querySelector(XCOM_CONTROL_ICON_SELECTOR)?.parentElement?.parentElement
      ?.parentElement?.parentElement ?? null
  )
}

export function getCurrentPrimaryXcomStatusVideo(): HTMLVideoElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLVideoElement>(`article video, ${XCOM_MEDIA_VIEW_SELECTOR} video`),
  ).filter(isCandidateStatusVideo)
  const statusId = getXcomStatusId()
  const current = statusId ? candidates.filter((video) => belongsToStatus(video, statusId)) : []

  return pickActiveCandidate(candidates, current)
}

// A quoted post's card links to no post of its own, so its video resolves to the post quoting
// it; the server finds the video by its media id, or as the only one, across both posts.
function getXcomVideoStatusId(video: HTMLVideoElement): string | null {
  const article = video.closest("article")
  if (!article) {
    return getMediaViewStatusId(video)
  }

  for (const anchor of article.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const statusId = getXcomStatusIdFromUrl(anchor.href)
    if (statusId) {
      return statusId
    }
  }

  return null
}

// The URL names only the main post, and names nothing on a timeline.
export function getCurrentXcomVideoId(): string | null {
  const video = getCurrentXcomSubtitlesVideo()
  return (video && getXcomVideoStatusId(video)) ?? getXcomStatusId()
}

const toXcomPostUrl = (statusId: string | null) =>
  statusId ? `https://x.com/i/status/${statusId}` : null

/** The playing video's own post, which a timeline or parent post URL does not name. */
export function getCurrentXcomVideoUrl(): string | null {
  return toXcomPostUrl(getCurrentXcomVideoId())
}

/** The post holding this video, never the page's: an ad links to no post of its own. */
export function getXcomVideoPostUrl(video: HTMLVideoElement): string | null {
  return toXcomPostUrl(getXcomVideoStatusId(video))
}

/** Its video is still a candidate: in the page, not behind the media view nor off its screen. */
export function isXcomCandidatePlayer(container: HTMLElement | null): boolean {
  const video = container?.querySelector("video")
  return !!video && isCandidateStatusVideo(video)
}

function getReadFrogXcomStatusVideo(): HTMLVideoElement | null {
  return pickSingleCandidate(
    Array.from(
      document.querySelectorAll<HTMLVideoElement>(`${XCOM_PLAYER_CONTAINER_SELECTOR} video`),
    ).filter(isCandidateStatusVideo),
  )
}

export function getCurrentXcomSubtitlesVideo(): HTMLVideoElement | null {
  return getReadFrogXcomStatusVideo() ?? getCurrentPrimaryXcomStatusVideo()
}
