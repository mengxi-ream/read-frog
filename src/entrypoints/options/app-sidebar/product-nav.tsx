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
import { cn } from "@/utils/styles/utils"
import { getLastViewedSurvey, hasNewSurvey, saveLastViewedSurvey } from "@/utils/survey"
import { AnimatedIndicator } from "./animated-indicator"

const SURVEY_URL = "https://tally.so/r/kdNN5R"

export function ProductNav() {
  const { open } = useSidebar()
  const queryClient = useQueryClient()

  const { data: lastViewedSurveyUrl } = useQuery({
    queryKey: ["last-viewed-survey"],
    queryFn: getLastViewedSurvey,
  })

  const handleSurveyClick = async () => {
    await saveLastViewedSurvey(SURVEY_URL)
    await queryClient.invalidateQueries({ queryKey: ["last-viewed-survey"] })
  }

  const showSurveyIndicator = hasNewSurvey(lastViewedSurveyUrl ?? null, SURVEY_URL)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.product")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
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
