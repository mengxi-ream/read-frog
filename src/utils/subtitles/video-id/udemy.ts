const UDEMY_LECTURE_PATH_PATTERN = /^\/course\/([^/]+)\/learn\/lecture\/(\d+)\/?$/

/** The lecture a Udemy course player is on, as `<course slug>/<lecture id>`, on any subdomain. */
export function getUdemyLectureIdFromUrl(url: string): string | null {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }

  const [, courseSlug, lectureId] = parsedUrl.pathname.match(UDEMY_LECTURE_PATH_PATTERN) || []
  return courseSlug && lectureId ? `${courseSlug}/${lectureId}` : null
}

export function getUdemyLectureId(): string | null {
  return getUdemyLectureIdFromUrl(window.location.href)
}

export function parseUdemyLectureId(id: string): { courseSlug: string; lectureId: string } {
  const [courseSlug = "", lectureId = ""] = id.split("/")
  return { courseSlug, lectureId }
}
