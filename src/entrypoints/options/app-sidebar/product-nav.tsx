import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/base-ui/sidebar"
import { getLastViewedBlogDate, getLatestBlogDate, hasNewBlogPost, saveLastViewedBlogDate } from "@/utils/blog"
import { WEBSITE_URL } from "@/utils/constants/url"
import { cn } from "@/utils/styles/utils"
import { getLastViewedSurvey, hasNewSurvey, saveLastViewedSurvey } from "@/utils/survey"
import { version } from "../../../../package.json"
import { AnimatedIndicator } from "./animated-indicator"

const SURVEY_URL = "https://tally.so/r/kdNN5R"

export function ProductNav() {
  const { open } = useSidebar()
  const queryClient = useQueryClient()

  const { data: lastViewedDate } = useQuery({
    queryKey: ["last-viewed-blog-date"],
    queryFn: getLastViewedBlogDate,
  })

  const { data: latestBlogPost } = useQuery({
    queryKey: ["latest-blog-post"],
    queryFn: () => getLatestBlogDate(`${WEBSITE_URL}/api/blog/latest`, "en", version),
  })

  const { data: lastViewedSurveyUrl } = useQuery({
    queryKey: ["last-viewed-survey"],
    queryFn: getLastViewedSurvey,
  })

  const handleWhatsNewClick = async () => {
    if (latestBlogPost) {
      await saveLastViewedBlogDate(latestBlogPost.date)
      await queryClient.invalidateQueries({ queryKey: ["last-viewed-blog-date"] })
    }
  }

  const handleSurveyClick = async () => {
    await saveLastViewedSurvey(SURVEY_URL)
    await queryClient.invalidateQueries({ queryKey: ["last-viewed-survey"] })
  }

  const showBlogIndicator = hasNewBlogPost(
    lastViewedDate ?? null,
    latestBlogPost?.date ?? null,
  )

  const showSurveyIndicator = hasNewSurvey(lastViewedSurveyUrl ?? null, SURVEY_URL)

  const blogUrl = latestBlogPost?.url
    ? `${WEBSITE_URL}${latestBlogPost.url}`
    : `${WEBSITE_URL}/blog?latest-indicator=true`

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.product")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem className="relative">
            <SidebarMenuButton
              render={<a href={blogUrl} target="_blank" rel="noopener noreferrer" onClick={handleWhatsNewClick} />}
              className={cn(showBlogIndicator && "text-primary font-semibold hover:text-primary active:text-primary")}
            >
              <Icon icon="tabler:sparkles" />
              <span>{i18n.t("options.whatsNew.title")}</span>
            </SidebarMenuButton>
            <AnimatedIndicator show={showBlogIndicator && open} />
          </SidebarMenuItem>

          <SidebarMenuItem className="relative">
            <SidebarMenuButton
              render={<a href={SURVEY_URL} target="_blank" rel="noopener noreferrer" onClick={handleSurveyClick} />}
              className={cn(showSurveyIndicator && "text-primary font-semibold hover:text-primary active:text-primary")}
            >
              <Icon icon="tabler:message-question" />
              <span>{i18n.t("options.survey.title")}</span>
            </SidebarMenuButton>
            <AnimatedIndicator show={showSurveyIndicator && open} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
