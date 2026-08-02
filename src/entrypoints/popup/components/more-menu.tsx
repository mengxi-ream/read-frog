import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { env } from "@/env"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { buildFeaturebasePortalUrl } from "@/utils/featurebase"
import { i18n } from "@/utils/i18n"
import { resolveUiLocale } from "@/utils/i18n/locale-map"
import { getReviewUrl } from "@/utils/utils"

const SUPPORT_EMAIL = "contact@readfrog.app"
const DISCORD_INVITE_URL = "https://discord.gg/ej45e3PezJ"
const GITHUB_REPO_URL = "https://github.com/mengxi-ream/read-frog"
const WECHAT_QR_URL = `${GITHUB_REPO_URL}/blob/main/assets/wechat-account.jpg`

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

/**
 * Grouped the same way as the options page it mirrors: what to read or reach us through
 * under Help, and where to find the other users under Community.
 */
export function MoreMenu() {
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const locale = resolveUiLocale(uiLanguage)

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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-fit">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{i18n.t("popup.more.help")}</DropdownMenuLabel>

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
