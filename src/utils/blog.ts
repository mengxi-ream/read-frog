import { storage } from "#imports"
import { semanticVersionSchema } from "@read-frog/definitions"
import { z } from "zod"
import { logger } from "./logger"
import { sendMessage } from "./message"

const LAST_VIEWED_BLOG_DATE_KEY = "lastViewedBlogDate"
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Zod schema for validating blog API response
 */
const blogApiResponseSchema = z.object({
  date: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  extensionVersion: semanticVersionSchema.nullable().optional(),
}).nullable()

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

/**
 * Fetches the latest blog post from the Read Frog blog API.
 * Uses background fetch with optional 1-day cache.
 *
 * @param apiUrl - The URL of the blog API endpoint (default: production URL)
 * @param locale - The locale to fetch the latest post for (default: 'en')
 * @param extensionVersion - The current extension version to filter compatible posts
 * @param useCache - Whether to use cache (default: true)
 * @returns Promise resolving to the latest blog post data (date, url, and extensionVersion), or null if no posts found
 *
 * @example
 * ```ts
 * const latestPost = await getLatestBlogDate('http://localhost:8888/api/blog/latest', 'en', '1.10.0')
 * console.log(latestPost) // { date: Date, url: '/blog/post-slug', extensionVersion: '1.11.0' }
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
): Promise<{ date: Date, url: string, extensionVersion?: string | null } | null> {
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

    // Parse and validate response with Zod
    const parsedBody = JSON.parse(response.body)
    const validationResult = blogApiResponseSchema.safeParse(parsedBody)

    if (!validationResult.success) {
      throw new Error(`Invalid blog API response: ${validationResult.error.message}`)
    }

    const latestPost = validationResult.data

    if (!latestPost) {
      return null
    }

    return {
      date: new Date(latestPost.date),
      url: latestPost.url,
      extensionVersion: latestPost.extensionVersion ?? null,
    }
  }
  catch (error) {
    logger.error("Error fetching latest blog post:", error)
    return null
  }
}
