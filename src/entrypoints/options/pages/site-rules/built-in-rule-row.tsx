import type { SiteRule } from "@/types/config/site-rules"
import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/base-ui/collapsible"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"

const VISIBLE_MATCH_BADGES = 2

export function BuiltInRuleRow({ rule }: { rule: SiteRule }) {
  const [siteRules, setSiteRules] = useAtom(configFieldsAtomMap.siteRules)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => {
      if (timerRef.current)
        clearTimeout(timerRef.current)
    }
  }, [])

  const enabled = !siteRules.disabledBuiltInRules.includes(rule.id)
  const matches = Array.isArray(rule.matches) ? rule.matches : [rule.matches]

  const handleCopy = (event: React.MouseEvent) => {
    event.stopPropagation()
    void navigator.clipboard.writeText(JSON.stringify(rule, null, 2))
    setCopied(true)
    if (timerRef.current)
      clearTimeout(timerRef.current)
    timerRef.current = setTimeout(setCopied, 1500, false)
  }

  const handleToggle = (checked: boolean) => {
    const disabledBuiltInRules = checked
      ? siteRules.disabledBuiltInRules.filter(id => id !== rule.id)
      : [...siteRules.disabledBuiltInRules, rule.id]
    void setSiteRules({ ...siteRules, disabledBuiltInRules })
  }

  return (
    <Collapsible className="group/site-rule">
      <div className="flex items-center gap-2 px-3 py-2">
        <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer">
          <Icon
            icon="tabler:chevron-right"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/site-rule:rotate-90"
          />
          <code className="text-xs shrink-0">{rule.id}</code>
          {rule.description && (
            <span className="text-xs text-muted-foreground truncate">{rule.description}</span>
          )}
          <span className="ml-auto flex items-center gap-1 shrink-0">
            {matches.slice(0, VISIBLE_MATCH_BADGES).map(pattern => (
              <Badge key={pattern} variant="secondary">
                <span className="max-w-40 truncate">{pattern}</span>
              </Badge>
            ))}
            {matches.length > VISIBLE_MATCH_BADGES && (
              <Badge variant="outline">
                +
                {matches.length - VISIBLE_MATCH_BADGES}
              </Badge>
            )}
          </span>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? i18n.t("action.copied") : i18n.t("action.copy")}
          onClick={handleCopy}
        >
          {copied
            ? <Icon icon="tabler:check" className="text-green-500" />
            : <Icon icon="tabler:copy" />}
        </Button>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          onClick={event => event.stopPropagation()}
          aria-label={rule.id}
        />
      </div>
      <CollapsibleContent>
        <pre className="text-xs overflow-x-auto rounded-md bg-muted p-3 mx-3 mb-3">
          {JSON.stringify(rule, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}
