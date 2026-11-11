import { useMemo, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../../components/config-item"
import { BuiltInRuleRow } from "./built-in-rule-row"
import { useActiveBuiltInSiteRules } from "./use-active-built-in-rules"

const PAGE_SIZE = 50

export function BuiltInRules() {
  const builtInRules = useActiveBuiltInSiteRules()
  const [search, setSearch] = useState("")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return builtInRules
    }
    return builtInRules.filter((rule) => {
      const matches = Array.isArray(rule.matches) ? rule.matches : [rule.matches]
      return (
        rule.id.toLowerCase().includes(query) ||
        (rule.description?.toLowerCase().includes(query) ?? false) ||
        matches.some((pattern) => pattern.toLowerCase().includes(query))
      )
    })
  }, [builtInRules, search])

  const visibleRules = filteredRules.slice(0, visibleCount)

  return (
    <ConfigItem
      id="site-rules-built-in"
      orientation="vertical"
      title={i18n.t("options.siteRules.builtIn.title")}
      description={i18n.t("options.siteRules.builtIn.description")}
    >
      <div className="flex flex-col gap-3">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setVisibleCount(PAGE_SIZE)
          }}
          placeholder={i18n.t("options.siteRules.builtIn.searchPlaceholder")}
        />
        <div className="text-xs text-muted-foreground">
          {i18n.t("options.siteRules.builtIn.count", [filteredRules.length, builtInRules.length])}
        </div>
        <div className="flex flex-col divide-y rounded-lg border">
          {visibleRules.map((rule) => (
            <BuiltInRuleRow key={rule.id} rule={rule} />
          ))}
        </div>
        {filteredRules.length > visibleCount && (
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            {i18n.t("options.siteRules.builtIn.showMore")}
          </Button>
        )}
      </div>
    </ConfigItem>
  )
}
