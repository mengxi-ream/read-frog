import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import { Activity } from "react"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { isCurrentSiteInPatternsAtom, toggleCurrentSiteAtom } from "../atoms/auto-translate"
import { isIgnoreTabAtom } from "../atoms/ignore"
import { isCurrentSiteInBlacklistAtom, isCurrentSiteInWhitelistAtom } from "../atoms/site-control"

export function AlwaysTranslate() {
  const isCurrentSiteInPatterns = useAtomValue(isCurrentSiteInPatternsAtom)
  const [, toggleCurrentSite] = useAtom(toggleCurrentSiteAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const isCurrentSiteInBlacklist = useAtomValue(isCurrentSiteInBlacklistAtom)

  const shouldShow = mode === "whitelist" ? isCurrentSiteInWhitelist : !isCurrentSiteInBlacklist

  return (
    <Activity mode={shouldShow ? "visible" : "hidden"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">
          {i18n.t("popup.alwaysTranslate")}
        </span>
        <Switch
          checked={isCurrentSiteInPatterns}
          onCheckedChange={toggleCurrentSite}
          disabled={isIgnoreTab}
        />
      </div>
    </Activity>
  )
}
