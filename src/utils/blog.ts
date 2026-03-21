import { storage } from "#imports"
import { semanticVersionSchema } from "@read-frog/definitions"
import { z } from "zod"
import { logger } from "./logger"
import { sendMessage } from "./message"

const LAST_VIEWED_BLOG_DATE_KEY = "lastViewedBlogDate"
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const BILIBILI_EMBED_HOSTNAME = "player.bilibili.com"
const BILIBILI_HOSTNAME_PATTERN = /(?:^|\.)bilibili\.com$/i
const BILIBILI_VIDEO_ID_PATTERN = /^BV[0-9A-Z]+$/i

function getBilibiliVideoIdFromParsedUrl(parsedUrl: URL): string | null {
  if (!BILIBILI_HOSTNAME_PATTERN.test(parsedUrl.hostname)) {
    return null
  }

  const bvid = parsedUrl.searchParams.get("bvid")
  if (BILIBILI_VIDEO_ID_PATTERN.test(bvid ?? "")) {
    return bvid
  }

  const [, maybeVideoSegment, maybeVideoId] = parsedUrl.pathname.split("/")
  if (maybeVideoSegment !== "video") {
    return null
  }

  return BILIBILI_VIDEO_ID_PATTERN.test(maybeVideoId ?? "") ? maybeVideoId ?? null : null
}

const bilibiliVideoUrlSchema = z.url().superRefine((url, ctx) => {
  if (getBilibiliVideoIdFromParsedUrl(new URL(url))) {
    return
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Must be a bilibili video URL with a valid BVID",
  })
})

const latestBlogPostSchema = z.object({
  date: z.string().pipe(z.coerce.date()),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  videoUrl: bilibiliVideoUrlSchema.optional(),
  extensionVersion: semanticVersionSchema.optional(),
})

export type LatestBlogPost = z.output<typeof latestBlogPostSchema>

const blogApiResponseSchema = latestBlogPostSchema.nullable()

/**
 * Saves the last viewed blog date to Chrome storage
 */
export async function saveLastViewedBlogDate(date: Date): Promise<void> {
  await storage.setItem(`local:${LAST_VIEWED_BLOG_DATE_KEY}`, date.toISOString())
}

/**
 * Retrieves the last viewed blog date from Chrome storage
 */
export async function getLastViewedBlogDate(): Promise<Date | null> {
  const dateStr = await storage.getItem<string>(`local:${LAST_VIEWED_BLOG_DATE_KEY}`)
  return dateStr ? new Date(dateStr) : null
}

/**
 * Checks if there's a new blog post by comparing last viewed date with latest blog date
 * @param latestViewedDate - The last date the user viewed the blog
 * @param latestDate - The date of the latest blog post
 */
export function hasNewBlogPost(
  latestViewedDate: Date | null,
  latestDate: Date | null,
): boolean {
  if (!latestDate)
    return false

  if (!latestViewedDate)
    return true
  return latestDate > latestViewedDate
}

export function extractBilibiliVideoId(url: string): string | null {
  const result = bilibiliVideoUrlSchema.safeParse(url)
  if (!result.success) {
    return null
  }

  return getBilibiliVideoIdFromParsedUrl(new URL(result.data))
}

export function buildBilibiliEmbedUrl(url: string): string | null {
  const videoId = extractBilibiliVideoId(url)
  if (!videoId) {
    return null
  }

  const embedUrl = new URL(`https://${BILIBILI_EMBED_HOSTNAME}/player.html`)
  embedUrl.searchParams.set("bvid", videoId)
  embedUrl.searchParams.set("autoplay", "1")
  embedUrl.searchParams.set("muted", "1")
  embedUrl.searchParams.set("danmaku", "0")
  return embedUrl.toString()
}

/**
 * Fetches the latest blog post from the Read Frog blog API.
 * Uses background fetch with optional 1-day cache.
 *
 * @param apiUrl - The URL of the blog API endpoint (default: production URL)
 * @param locale - The locale to fetch the latest post for (default: 'en')
 * @param extensionVersion - The current extension version to filter compatible posts
 * @param useCache - Whether to use cache (default: true)
 * @returns Promise resolving to the latest blog post metadata, or null if no posts found
 *
 * @example
 * ```ts
 * const latestPost = await getLatestBlogDate('http://localhost:8888/api/blog/latest', 'en', '1.10.0')
 * console.log(latestPost)
 * // {
 * //   date: Date,
 * //   title: 'Spring update',
 * //   description: 'New subtitle features shipped.',
 * //   url: '/blog/post-slug',
 * //   videoUrl: 'https://www.bilibili.com/video/BV...',
 * //   extensionVersion: '1.11.0',
 * // }
 *
 * // Without cache
 * const freshPost = await getLatestBlogDate('http://localhost:8888/api/blog/latest', 'en', '1.10.0', false)
 * ```
 */
export async function getLatestBlogDate(
  apiUrl: string = "https://readfrog.app/api/blog/latest",
  locale: string = "en",
  extensionVersion?: string,
  useCache: boolean = true,
): Promise<LatestBlogPost | null> {
  try {
    const url = new URL(apiUrl)
    url.searchParams.set("locale", locale)
    if (extensionVersion) {
      url.searchParams.set("extensionVersion", extensionVersion)
    }

    const response = await sendMessage("backgroundFetch", {
      url: url.toString(),
      method: "GET",
      cacheConfig: useCache
        ? {
            enabled: true,
            groupKey: "blog-fetch",
            ttl: ONE_DAY_MS,
          }
        : undefined,
    })

    if (response.status !== 200) {
      throw new Error(`Failed to fetch blog: ${response.status}`)
    }

    return blogApiResponseSchema.parse(JSON.parse(response.body))
  }
  catch (error) {
    logger.error("Error fetching latest blog post:", error)
    return null
  }
}
