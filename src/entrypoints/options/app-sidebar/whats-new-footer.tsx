import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useEffectEvent, useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/base-ui/popover"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/base-ui/sidebar"
import {
  buildBilibiliEmbedUrl,
  getLastViewedBlogDate,
  getLatestBlogDate,
  hasNewBlogPost,
  saveLastViewedBlogDate,
} from "@/utils/blog"
import { WEBSITE_URL } from "@/utils/constants/url"
import { version } from "../../../../package.json"

export function WhatsNewFooter() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: lastViewedDate, isFetched: isLastViewedDateFetched } = useQuery({
    queryKey: ["last-viewed-blog-date"],
    queryFn: getLastViewedBlogDate,
  })

  const { data: latestBlogPost, isFetched: isLatestBlogPostFetched } = useQuery({
    queryKey: ["latest-blog-post"],
    queryFn: () => getLatestBlogDate(`${WEBSITE_URL}/api/blog/latest`, "en", version),
  })

  const markLatestBlogPostViewed = useEffectEvent(async () => {
    if (!latestBlogPost) {
      return
    }

    if (!isLastViewedDateFetched) {
      return
    }

    if (lastViewedDate && lastViewedDate.getTime() >= latestBlogPost.date.getTime()) {
      return
    }

    await saveLastViewedBlogDate(latestBlogPost.date)
    await queryClient.invalidateQueries({ queryKey: ["last-viewed-blog-date"] })
  })

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
  }, [])

  const openPopover = useEffectEvent(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setOpen(true)
  })

  const latestBlogPostDate = latestBlogPost?.date ?? null
  const latestBlogPostKey = latestBlogPost
    ? `${latestBlogPost.url}:${latestBlogPost.date.toISOString()}`
    : null
  const lastViewedDateTimestamp = lastViewedDate?.getTime() ?? null
  const shouldAutoOpenPopover = isLastViewedDateFetched
    && isLatestBlogPostFetched
    && hasNewBlogPost(lastViewedDate ?? null, latestBlogPostDate)

  useEffect(() => {
    if (!shouldAutoOpenPopover) {
      return
    }

    openPopover()
  }, [shouldAutoOpenPopover])

  // Persist the visible post so it doesn't reopen on the next visit.
  useEffect(() => {
    if (!open) {
      return
    }

    void markLatestBlogPostViewed()
  }, [isLastViewedDateFetched, lastViewedDateTimestamp, latestBlogPostKey, open])

  if (!latestBlogPost) {
    return null
  }

  const blogUrl = new URL(latestBlogPost.url, WEBSITE_URL).toString()
  const embedUrl = latestBlogPost.videoUrl ? buildBilibiliEmbedUrl(latestBlogPost.videoUrl) : null

  return (
    <Popover
      key={latestBlogPostKey}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <SidebarMenu>
        <SidebarMenuItem>
          <PopoverTrigger
            render={(
              <SidebarMenuButton
                aria-label={i18n.t("options.whatsNew.title")}
              />
            )}
          >
            <Icon icon="tabler:rss" />
            <span>{i18n.t("options.whatsNew.title")}</span>
          </PopoverTrigger>
        </SidebarMenuItem>
      </SidebarMenu>

      <PopoverContent
        align="end"
        initialFocus={openType => openType === "keyboard"}
        side="top"
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] gap-4 p-3"
      >
        {embedUrl && (
          <div className="overflow-hidden rounded-md border bg-black">
            <iframe
              title={latestBlogPost.title}
              src={embedUrl}
              className="aspect-video w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}

        <PopoverHeader className="gap-2">
          <PopoverTitle>
            <a
              href={blogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group hover:underline"
            >
              <span className="min-w-0">
                {latestBlogPost.title}
                <Icon
                  aria-hidden="true"
                  icon="tabler:external-link"
                  className="ml-1 inline size-[1em] align-[-0.125em] text-muted-foreground transition-colors group-hover:text-foreground"
                />
              </span>
            </a>
          </PopoverTitle>
          <PopoverDescription>
            {latestBlogPost.description}
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
