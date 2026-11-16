import { Icon } from "@iconify/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { Badge } from "@/components/ui/base-ui/badge"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/base-ui/sidebar"
import { env } from "@/env"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getBlogLocaleFromUILanguage } from "@/utils/blog"
import {
  buildSurveyPromptUrl,
  getClickedSurveyPromptKeys,
  getSurveyPrompt,
  markSurveyPromptClicked,
} from "@/utils/survey-prompt"

const CLICKED_QUERY_KEY = ["survey-prompt-clicked"] as const

/**
 * A link to the survey Ribbit chose to show in the extension, while it takes
 * answers. Nothing at all when there is none, or the request fails. The server
 * writes its words in the reader's language, falling back to English; the badge
 * after them goes once the reader has clicked, and stays gone for that survey.
 */
export function SurveyNavItem() {
  const queryClient = useQueryClient()
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const locale = getBlogLocaleFromUILanguage(uiLanguage)

  const { data: prompt } = useQuery({
    queryKey: ["survey-prompt", locale],
    queryFn: () => getSurveyPrompt(locale),
    meta: { suppressToast: true },
  })
  const { data: clickedKeys } = useQuery({
    queryKey: CLICKED_QUERY_KEY,
    queryFn: getClickedSurveyPromptKeys,
    meta: { suppressToast: true },
  })

  if (!prompt) {
    return null
  }

  // Wait for the clicked list, or the badge would flash for someone who has clicked.
  const showBadge =
    prompt.badge !== null && clickedKeys !== undefined && !clickedKeys.includes(prompt.key)

  const markClicked = () => {
    queryClient.setQueryData<string[]>(CLICKED_QUERY_KEY, (keys = []) =>
      keys.includes(prompt.key) ? keys : [...keys, prompt.key],
    )
    void markSurveyPromptClicked(prompt.key)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <a
            href={buildSurveyPromptUrl(prompt, env.WXT_WEBSITE_URL)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={markClicked}
            onAuxClick={markClicked}
          />
        }
        tooltip={prompt.label}
        className="relative"
      >
        <Icon icon="tabler:clipboard-list" />
        <span className="truncate">{prompt.label}</span>
        {showBadge && (
          <>
            <Badge
              variant="accent"
              size="sm"
              className="ml-auto group-data-[collapsible=icon]:hidden"
            >
              {prompt.badge}
            </Badge>
            {/* The collapsed sidebar has no room for the badge: a dot on the icon stands for it. */}
            <span
              aria-hidden="true"
              data-testid="survey-nav-dot"
              className="absolute top-[5px] left-[19px] hidden size-[7px] rounded-full bg-accent ring-2 ring-sidebar group-data-[collapsible=icon]:block"
            />
          </>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
