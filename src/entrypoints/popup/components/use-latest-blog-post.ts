import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { env } from "@/env"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  getBlogLocaleFromUILanguage,
  getLastViewedBlogDate,
  getLatestBlogDate,
  hasNewBlogPost,
  saveLastViewedBlogDate,
} from "@/utils/blog"
import { openInNewTab } from "@/utils/navigation"
import { version } from "../../../../package.json"

/**
 * The newest post on the Read Frog blog, for the More menu's "What's New": whether there is one
 * the user has not opened yet, and how to open it, which also marks it read.
 */
export function useLatestBlogPost() {
  const queryClient = useQueryClient()
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const blogLocale = getBlogLocaleFromUILanguage(uiLanguage)

  const { data: lastViewedDate } = useQuery({
    queryKey: ["last-viewed-blog-date"],
    queryFn: getLastViewedBlogDate,
  })

  const { data: latestBlogPost } = useQuery({
    queryKey: ["latest-blog-post", blogLocale],
    queryFn: () => getLatestBlogDate(`${env.WXT_WEBSITE_URL}/api/blog/latest`, blogLocale, version),
  })

  const open = async () => {
    if (latestBlogPost) {
      await saveLastViewedBlogDate(latestBlogPost.date)
      await queryClient.invalidateQueries({ queryKey: ["last-viewed-blog-date"] })
    }
    // The latest post itself when there is one, the blog's index otherwise.
    const blogUrl = latestBlogPost?.url
      ? `${env.WXT_WEBSITE_URL}${latestBlogPost.url}`
      : `${env.WXT_WEBSITE_URL}/blog`
    await openInNewTab(blogUrl)
  }

  return {
    hasNewPost: hasNewBlogPost(lastViewedDate ?? null, latestBlogPost?.date ?? null),
    open,
  }
}
