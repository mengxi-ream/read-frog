import type { EbookBridgeSelectionPayload, NoteOriginInput } from "@read-frog/definitions"
import { noteOriginInputSchema, toNoteOriginUrl } from "@read-frog/definitions"

interface NoteOriginPage {
  href: string
  title: string
}

/** The page this script runs in; empty where there is none (a worker, a test without a DOM). */
function readCurrentPage(): NoteOriginPage {
  return {
    href: globalThis.location?.href ?? "",
    title: globalThis.document?.title ?? "",
  }
}

function getPageTitle(page: NoteOriginPage) {
  const title = page.title.trim()
  return title ? { title } : {}
}

/**
 * The page a selection was made on, read when the selection is made: a save can
 * finish later in the background, where `location` is no longer the page.
 * Null for pages a note cannot link back to (extension pages, file://, about:).
 */
export function getWebPageNoteOrigin(page = readCurrentPage()): NoteOriginInput | null {
  const url = toNoteOriginUrl(page.href)
  return url ? { kind: "webpage", url, ...getPageTitle(page) } : null
}

/**
 * The book a selection relayed from the readfrog.app ebook reader was made in.
 * Null when the reader did not say which book (an older website): the reader's
 * own URL is not where the text came from.
 */
export function getEbookNoteOrigin(
  payload: Pick<EbookBridgeSelectionPayload, "ebookId" | "cfi">,
): NoteOriginInput | null {
  if (!payload.ebookId) {
    return null
  }

  const parsed = noteOriginInputSchema.safeParse({
    kind: "ebook",
    ebookId: payload.ebookId,
    ...(payload.cfi ? { cfi: payload.cfi } : {}),
  })
  return parsed.success ? parsed.data : null
}

function isVideoSeconds(seconds: number | undefined): seconds is number {
  return seconds !== undefined && Number.isFinite(seconds) && seconds >= 0
}

/** The video page a subtitle save comes from, at `seconds` into the video when known. */
export function getVideoNoteOrigin(
  seconds?: number,
  page = readCurrentPage(),
): NoteOriginInput | null {
  const url = toNoteOriginUrl(page.href)
  if (!url) {
    return null
  }

  return {
    kind: "video",
    url,
    ...getPageTitle(page),
    ...(isVideoSeconds(seconds) ? { seconds } : {}),
  }
}

/** The origin with the video's playing time filled in; other origins are left as they are. */
export function withVideoNoteOriginSeconds(
  origin: NoteOriginInput | null,
  seconds: number | undefined,
): NoteOriginInput | null {
  return origin?.kind === "video" && isVideoSeconds(seconds) ? { ...origin, seconds } : origin
}
