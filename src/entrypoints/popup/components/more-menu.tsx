import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { browser } from "#imports"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { toastManager } from "@/components/ui/base-ui/toast"
import { env } from "@/env"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { buildFeaturebasePortalUrl } from "@/utils/featurebase"
import { i18n } from "@/utils/i18n"
import { resolveUiLocale } from "@/utils/i18n/locale-map"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { getReviewUrl } from "@/utils/utils"
import { useLatestBlogPost } from "./use-latest-blog-post"

const SUPPORT_EMAIL = "contact@readfrog.app"
const DISCORD_INVITE_URL = "https://discord.gg/ej45e3PezJ"
const GITHUB_REPO_URL = "https://github.com/mengxi-ream/read-frog"
const WECHAT_QR_URL = `${GITHUB_REPO_URL}/blob/main/assets/wechat-account.jpg`

const log = createLogger("popup/more-menu")

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

/** Opens the panel on the page itself, then gets out of its way. */
async function diagnoseCurrentPage() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id === undefined) throw new Error("No active tab")
    await sendMessage("togglePageTranslationDiagnostics", undefined, { tabId: tab.id, frameId: 0 })
    window.close()
  } catch (error) {
    // Pages the extension cannot run on (browser pages, the store, disabled sites).
    log.warn("Could not open the page diagnosis", { error })
    toastManager.add({ type: "error", title: i18n.t("pageDiagnosis.unavailable") })
  }
}

/** Marks a blog post the user has not opened yet, on the menu's trigger and on its item. */
function NewPostDot({ className }: { className?: string }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full bg-accent", className)} />
}

/**
 * Grouped the same way as the options page it mirrors: what to read or reach us through
 * under Help, and where to find the other users under Community. "What's New" leads Help, and
 * a new blog post puts a dot on it and on the menu's trigger.
 */
export function MoreMenu() {
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const locale = resolveUiLocale(uiLanguage)
  const latestBlogPost = useLatestBlogPost()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
          />
        }
      >
        <Icon icon="tabler:dots" className="size-4" strokeWidth={1.6} />
        <span className="text-[13px] font-medium">{i18n.t("popup.more.title")}</span>
        {latestBlogPost.hasNewPost && (
          <>
            <NewPostDot />
            <span className="sr-only">{i18n.t("popup.blog.notification")}</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-fit">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{i18n.t("popup.more.help")}</DropdownMenuLabel>

          <DropdownMenuItem onClick={() => void latestBlogPost.open()} className="cursor-pointer">
            <Icon icon="tabler:rss" className="size-4" strokeWidth={1.6} />
            {i18n.t("options.whatsNew.title")}
            {latestBlogPost.hasNewPost && <NewPostDot className="ml-auto" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            // The docs site picks its own locale from the browser.
            onClick={() => openExternal(`${env.WXT_WEBSITE_URL}/docs`)}
            className="cursor-pointer"
          >
            <Icon icon="tabler:help-circle" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.tutorial")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => openExternal(`mailto:${SUPPORT_EMAIL}`)}
            className="cursor-pointer"
          >
            <Icon icon="tabler:mail" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.emailUs")}
          </DropdownMenuItem>

          <DropdownMenuItem
            // The portal's own root is the feedback board; `tickets` is the support queue.
            onClick={() =>
              openExternal(buildFeaturebasePortalUrl({ destination: "feedback", locale }))
            }
            className="cursor-pointer"
          >
            <Icon icon="tabler:message-circle" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.featureRequest")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() =>
              openExternal(buildFeaturebasePortalUrl({ destination: "tickets", locale }))
            }
            className="cursor-pointer"
          >
            <Icon icon="tabler:bug" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.bugReport")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => void diagnoseCurrentPage()} className="cursor-pointer">
            <Icon icon="tabler:stethoscope" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.diagnosePage")}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>{i18n.t("popup.more.community")}</DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => openExternal(DISCORD_INVITE_URL)}
            className="cursor-pointer"
          >
            <Icon icon="logos:discord-icon" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.joinDiscord")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => openExternal(WECHAT_QR_URL)} className="cursor-pointer">
            <Icon icon="streamline-logos:wechat-logo-solid" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.joinWechat")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => openExternal(GITHUB_REPO_URL)}
            className="cursor-pointer"
          >
            <Icon icon="fa7-brands:github" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.starGithub")}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => openExternal(getReviewUrl("popup"))}
            className="cursor-pointer"
          >
            <Icon icon="tabler:star" className="size-4" strokeWidth={1.6} />
            {i18n.t("popup.more.rateUs")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
