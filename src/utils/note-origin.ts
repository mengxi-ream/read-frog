import type { EbookBridgeSelectionPayload, NoteOriginInput } from "@read-frog/definitions"
import { noteOriginInputSchema, toNoteOriginUrl } from "@read-frog/definitions"
import { getSourceDocumentTitle } from "@/utils/content/document-title"

interface NoteOriginPage {
  href: string
  title: string
}

/**
 * The page this script runs in, with the title the page set rather than one
 * page translation wrote over it. Empty where there is no page (a worker, a
 * test without a DOM).
 */
function readCurrentPage(): NoteOriginPage {
  return {
    href: globalThis.location?.href ?? "",
    title: typeof document === "undefined" ? "" : getSourceDocumentTitle(),
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

/**
 * The video a subtitle save comes from, at `seconds` into it when known.
 * `videoPageUrl` is the platform's link to the playing video, for pages whose
 * URL does not name it (an x.com timeline); the page's title then describes
 * the page, not the video, so it is left out.
 */
export function getVideoNoteOrigin(
  {
    seconds,
    videoPageUrl,
  }: {
    seconds?: number
    videoPageUrl?: string | null
  } = {},
  page = readCurrentPage(),
): NoteOriginInput | null {
  const url = toNoteOriginUrl(videoPageUrl ?? page.href)
  if (!url) {
    return null
  }

  return {
    kind: "video",
    url,
    ...(videoPageUrl ? {} : getPageTitle(page)),
    ...(isVideoSeconds(seconds) ? { seconds } : {}),
  }
}
