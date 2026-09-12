import { Icon } from "@iconify/react"
import { Link, useLocation } from "react-router"
import { browser } from "#imports"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/base-ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/base-ui/sidebar"
import { TRANSLATION_HUB_PAGE_PATH } from "@/utils/constants/translation-hub"
import { i18n } from "@/utils/i18n"

const OVERLAY_TOOLS_PATHS = ["/floating-button", "/selection-toolbar", "/context-menu"] as const
/**
 * The three places a translation happens. Grouped because they are one feature
 * seen in three surfaces — a page, a video, a text box — and listing them flat
 * put three of the eight top-level entries on the same subject.
 *
 * `startsWith`, because two of them own detail pages (`/page-translation/prompts`
 * and the rest), and the group has to stay lit while one is open.
 */
const TRANSLATION_PATHS = ["/page-translation", "/video-subtitles", "/input-translation"] as const

export function FeaturesNav() {
  const { pathname } = useLocation()
  const isOverlayToolsActive = OVERLAY_TOOLS_PATHS.includes(pathname)
  const isTranslationActive = TRANSLATION_PATHS.some((path) => pathname.startsWith(path))
  // `startsWith`, so the group stays lit while a single glossary is open on
  // `/advanced/glossary/:glossaryId`.
  const isAdvancedActive = pathname.startsWith("/advanced")

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.features")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/custom-actions" />}
              isActive={pathname === "/custom-actions"}
              tooltip={i18n.t("options.selectionToolbar.customActions.title")}
            >
              <Icon icon="tabler:sparkles" />
              <span>{i18n.t("options.selectionToolbar.customActions.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible defaultOpen={isTranslationActive} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    isActive={isTranslationActive}
                    tooltip={i18n.t("options.sidebar.translation")}
                  />
                }
              >
                {/* Page translation's own icon stands for the group: it is the
                    feature the other two are variations of. */}
                <Icon icon="ri:translate" />
                <span>{i18n.t("options.sidebar.translation")}</span>
                <Icon
                  icon="tabler:chevron-right"
                  className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/page-translation" />}
                      isActive={pathname.startsWith("/page-translation")}
                    >
                      <span>{i18n.t("options.translation.title")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/video-subtitles" />}
                      isActive={pathname.startsWith("/video-subtitles")}
                    >
                      <span>{i18n.t("options.videoSubtitles.title")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/input-translation" />}
                      isActive={pathname === "/input-translation"}
                    >
                      <span>{i18n.t("options.inputTranslation.title")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          <Collapsible defaultOpen={isOverlayToolsActive} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    isActive={isOverlayToolsActive}
                    tooltip={i18n.t("options.overlayTools.title")}
                  />
                }
              >
                <Icon icon="tabler:layers-intersect" />
                <span>{i18n.t("options.overlayTools.title")}</span>
                <Icon
                  icon="tabler:chevron-right"
                  className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/floating-button" />}
                      isActive={pathname === "/floating-button"}
                    >
                      <span>{i18n.t("options.floatingButton.title")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/selection-toolbar" />}
                      isActive={pathname === "/selection-toolbar"}
                    >
                      <span>{i18n.t("options.selectionToolbar.title")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/context-menu" />}
                      isActive={pathname === "/context-menu"}
                    >
                      <span>{i18n.t("options.contextMenu.title")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link to="/tts" />}
              isActive={pathname === "/tts"}
              tooltip={i18n.t("options.tts.title")}
            >
              <Icon icon="tabler:speakerphone" />
              <span>{i18n.t("options.tts.title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <a
                  href={browser.runtime.getURL(TRANSLATION_HUB_PAGE_PATH)}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              tooltip={i18n.t("options.tools.translationHub")}
            >
              <Icon icon="tabler:language-hiragana" />
              <span>{i18n.t("options.tools.translationHub")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <Collapsible defaultOpen={isAdvancedActive} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    isActive={isAdvancedActive}
                    tooltip={i18n.t("options.advanced.title")}
                  />
                }
              >
                <Icon icon="tabler:flask" />
                <span>{i18n.t("options.advanced.title")}</span>
                <Icon
                  icon="tabler:chevron-right"
                  className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      render={<Link to="/advanced/glossary" />}
                      isActive={pathname.startsWith("/advanced/glossary")}
                    >
                      <span>{i18n.t("options.advanced.glossary.title")}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
