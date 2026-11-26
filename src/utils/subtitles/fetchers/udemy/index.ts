import type { SubtitlesTrack, SubtitlesTrackSource } from "../track"
import { z } from "zod"
import { NoSubtitlesError, TrackFileNotLoadedError } from "@/utils/subtitles/errors"
import { getUdemyLectureId, parseUdemyLectureId } from "@/utils/subtitles/video-id"
import { fetchWithRetry, readJson } from "../fetch-with-retry"
import { parseWebVtt } from "../vtt"

const courseSchema = z.object({ id: z.number(), locale: z.object({ locale: z.string() }) })

type Course = z.infer<typeof courseSchema>

const lectureSchema = z.object({ asset: z.object({ captions: z.array(z.unknown()) }) })

const captionFields = {
  source: z.string(),
  // 1 is a caption Udemy finished processing.
  status: z.literal(1),
  url: z.string().nonempty(),
}

// Udemy names the language `locale_id` or `locale`, a code or an object, by the fields it serves.
const captionSchema = z.union([
  z.object({ ...captionFields, locale_id: z.string() }),
  z
    .object({ ...captionFields, locale: z.union([z.string(), z.object({ locale: z.string() })]) })
    .transform(({ locale, ...caption }) => ({
      ...caption,
      locale_id: typeof locale === "string" ? locale : locale.locale,
    })),
])

type Caption = z.infer<typeof captionSchema>

// A slug names one course for good, so its id and language are asked once per page.
const courseBySlug = new Map<string, Course>()

async function getJson(path: string): Promise<unknown> {
  return readJson(await fetchWithRetry(new URL(path, window.location.origin)))
}

async function getCourse(slug: string): Promise<Course | null> {
  const cached = courseBySlug.get(slug)
  if (cached) return cached

  const parsed = courseSchema.safeParse(
    await getJson(`/api-2.0/courses/${slug}/?fields[course]=id,locale`),
  )
  if (!parsed.success) return null
  courseBySlug.set(slug, parsed.data)
  return parsed.data
}

function languageOf(locale: string): string {
  return locale.split("_")[0] ?? locale
}

// The other languages Udemy offers are machine translations of the course's own language, so a
// caption in that language comes first, the uploaded one before Udemy's automatic one.
function pickCaption(captions: unknown[], courseLocale: string): Caption | null {
  const ready = captions.flatMap((caption) => {
    const parsed = captionSchema.safeParse(caption)
    return parsed.success ? [parsed.data] : []
  })
  const courseLanguage = languageOf(courseLocale)
  const preferUploaded = (list: Caption[]) =>
    list.find((caption) => caption.source === "manual") ?? list[0]
  return (
    preferUploaded(ready.filter((caption) => languageOf(caption.locale_id) === courseLanguage)) ??
    preferUploaded(ready) ??
    null
  )
}

async function loadTrack(key: string): Promise<SubtitlesTrack> {
  const { courseSlug, lectureId } = parseUdemyLectureId(key)

  const course = await getCourse(courseSlug)
  if (!course) throw new TrackFileNotLoadedError()

  const parsedLecture = lectureSchema.safeParse(
    await getJson(
      `/api-2.0/users/me/subscribed-courses/${course.id}/lectures/${lectureId}/?fields[lecture]=asset&fields[asset]=captions`,
    ),
  )
  if (!parsedLecture.success) throw new TrackFileNotLoadedError()

  const caption = pickCaption(parsedLecture.data.asset.captions, course.locale.locale)
  if (!caption) throw new NoSubtitlesError()

  const response = await fetchWithRetry(caption.url)
  // `text()` drops a leading byte order mark, so a WebVTT file starts with its signature here.
  const vtt = response?.ok ? await response.text().catch(() => null) : null
  if (!vtt?.startsWith("WEBVTT")) throw new TrackFileNotLoadedError()

  return { language: caption.locale_id.replace("_", "-"), fragments: parseWebVtt(vtt) }
}

export const udemyTrackSource: SubtitlesTrackSource = {
  currentKey: getUdemyLectureId,
  load: loadTrack,
}
