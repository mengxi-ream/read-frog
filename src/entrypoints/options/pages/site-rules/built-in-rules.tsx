import { useMemo, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import { i18n } from "@/utils/i18n"
import { BUILT_IN_SITE_RULES } from "@/utils/site-rules/built-in"
import { ConfigCard } from "../../components/config-card"
import { BuiltInRuleRow } from "./built-in-rule-row"

const PAGE_SIZE = 50

export function BuiltInRules() {
  const [search, setSearch] = useState("")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filteredRules = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return BUILT_IN_SITE_RULES
    }
    return BUILT_IN_SITE_RULES.filter((rule) => {
      const matches = Array.isArray(rule.matches) ? rule.matches : [rule.matches]
      return (
        rule.id.toLowerCase().includes(query) ||
        (rule.description?.toLowerCase().includes(query) ?? false) ||
        matches.some((pattern) => pattern.toLowerCase().includes(query))
      )
    })
  }, [search])

  const visibleRules = filteredRules.slice(0, visibleCount)

  return (
    <ConfigCard
      id="site-rules-built-in"
      title={i18n.t("options.siteRules.builtIn.title")}
      description={i18n.t("options.siteRules.builtIn.description")}
      className="lg:flex-col lg:[&>div]:basis-auto"
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
          {i18n.t("options.siteRules.builtIn.count", [
            filteredRules.length,
            BUILT_IN_SITE_RULES.length,
          ])}
        </div>
        <div className="flex flex-col divide-y rounded-md border">
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
    </ConfigCard>
  )
}
