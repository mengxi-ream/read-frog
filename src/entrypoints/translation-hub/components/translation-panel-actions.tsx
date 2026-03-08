import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { selectedProviderIdsAtom, translationCardExpandedStateAtom } from "../atoms"

export function TranslationPanelActions() {
  const selectedProviderIds = useAtomValue(selectedProviderIdsAtom)
  const [expandedById, setExpandedById] = useAtom(translationCardExpandedStateAtom)

  if (selectedProviderIds.length === 0)
    return null

  const expandedCount = selectedProviderIds.filter(id => expandedById[id] ?? true).length
  const areAllExpanded = expandedCount === selectedProviderIds.length
  const areAllCollapsed = expandedCount === 0

  const setAllCardsExpanded = (expanded: boolean) => {
    setExpandedById((prev) => {
      const next = { ...prev }

      for (const id of selectedProviderIds) {
        next[id] = expanded
      }

      return next
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setAllCardsExpanded(true)}
        disabled={areAllExpanded}
        title={i18n.t("translationHub.expandAllCards")}
        aria-label={i18n.t("translationHub.expandAllCards")}
      >
        <Icon icon="tabler:chevrons-down" className="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setAllCardsExpanded(false)}
        disabled={areAllCollapsed}
        title={i18n.t("translationHub.collapseAllCards")}
        aria-label={i18n.t("translationHub.collapseAllCards")}
      >
        <Icon icon="tabler:chevrons-up" className="size-3.5" />
      </Button>
    </div>
  )
}
