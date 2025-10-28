import { i18n } from '#imports'
import { Icon } from '@iconify/react/dist/iconify.js'
import { Button } from '@repo/ui/components/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getLastViewedBlogDate, getLatestBlogDate, hasNewBlogPost, saveLastViewedBlogDate } from '@/utils/blog'
import { WEBSITE_URL } from '@/utils/constants/url'
import { version } from '../../../../package.json'

export default function BlogNotification() {
  const queryClient = useQueryClient()

  const { data: lastViewedDate } = useQuery({
    queryKey: ['last-viewed-blog-date'],
    queryFn: getLastViewedBlogDate,
  })

  const { data: latestBlogPost } = useQuery({
    queryKey: ['latest-blog-post'],
    queryFn: () => getLatestBlogDate(`${WEBSITE_URL}/api/blog/latest`, 'en'),
  })

  const handleClick = async () => {
    if (latestBlogPost) {
      await saveLastViewedBlogDate(latestBlogPost.date)
      await queryClient.invalidateQueries({ queryKey: ['last-viewed-blog-date'] })
    }
    // Open the latest blog post URL directly, or fallback to /blog if not available
    // Convert relative URL to absolute URL
    const blogUrl = latestBlogPost?.url
      ? `${WEBSITE_URL}${latestBlogPost.url}`
      : `${WEBSITE_URL}/blog`
    window.open(blogUrl, '_blank')
  }

  const showIndicator = hasNewBlogPost(
    lastViewedDate ?? null,
    latestBlogPost?.date ?? null,
    version,
    latestBlogPost?.extensionVersion ?? null,
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={handleClick}
        >
          <Icon icon="tabler:bell" />
          {showIndicator && (
            <span className="absolute top-1.5 right-1.5 flex items-center justify-center size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex size-1.5 rounded-full bg-primary"></span>
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {i18n.t('popup.blog.notification')}
      </TooltipContent>
    </Tooltip>
  )
}
