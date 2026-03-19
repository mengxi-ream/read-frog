export interface FrameInfoForSiteControl {
  frameId: number
  parentFrameId: number
  url?: string
}

const SITE_CONTROL_URL_RE = /^(?:https?|file):/i

function isSiteControlUrl(url: string | undefined): url is string {
  if (!url) {
    return false
  }

  return SITE_CONTROL_URL_RE.test(url)
}

function findNearestSiteControlUrl(
  startFrameId: number | undefined,
  framesById: Map<number, FrameInfoForSiteControl>,
): string | undefined {
  if (typeof startFrameId !== "number") {
    return undefined
  }

  const visitedFrameIds = new Set<number>()
  let currentFrameId: number | undefined = startFrameId

  while (typeof currentFrameId === "number") {
    if (visitedFrameIds.has(currentFrameId)) {
      return undefined
    }
    visitedFrameIds.add(currentFrameId)

    const currentFrame = framesById.get(currentFrameId)
    if (!currentFrame) {
      return undefined
    }

    if (isSiteControlUrl(currentFrame.url)) {
      return currentFrame.url
    }

    if (currentFrame.parentFrameId < 0 || currentFrame.parentFrameId === currentFrame.frameId) {
      return undefined
    }

    currentFrameId = currentFrame.parentFrameId
  }

  return undefined
}

export function resolveSiteControlUrl(
  frameId: number,
  frameUrl: string | undefined,
  frames: FrameInfoForSiteControl[],
  parentFrameId?: number,
): string | undefined {
  if (isSiteControlUrl(frameUrl)) {
    return frameUrl
  }

  const framesById = new Map(frames.map(frame => [frame.frameId, frame]))
  const startFrameId = framesById.has(frameId) ? frameId : parentFrameId
  return findNearestSiteControlUrl(startFrameId, framesById)
}
