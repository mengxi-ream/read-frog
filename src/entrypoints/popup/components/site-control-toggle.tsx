import { i18n } from "#imports"
import { useAtomValue, useSetAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { isIgnoreTabAtom } from "../atoms/ignore"
import { isCurrentSiteInBlacklistAtom, isCurrentSiteInWhitelistAtom, toggleCurrentSiteInBlacklistAtom, toggleCurrentSiteInWhitelistAtom } from "../atoms/site-control"

export function SiteControlToggle() {
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const isInList = useAtomValue(mode === "whitelist" ? isCurrentSiteInWhitelistAtom : isCurrentSiteInBlacklistAtom)
  const toggleSite = useSetAtom(mode === "whitelist" ? toggleCurrentSiteInWhitelistAtom : toggleCurrentSiteInBlacklistAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const label = mode === "whitelist" ? i18n.t("popup.addToWhitelist") : i18n.t("popup.addToBlacklist")

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium">{label}</span>
      <Switch checked={isInList} onCheckedChange={toggleSite} disabled={isIgnoreTab} />
    </div>
  )
}
