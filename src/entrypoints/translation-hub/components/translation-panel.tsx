import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/base-ui/empty"
import { selectedProviderIdsAtom, translationCardExpandedStateAtom } from "../atoms"
import { TranslationCard } from "./translation-card"

export function TranslationPanel() {
  const selectedProviderIds = useAtomValue(selectedProviderIdsAtom)
  const expandedById = useAtomValue(translationCardExpandedStateAtom)
  const setExpandedById = useSetAtom(translationCardExpandedStateAtom)

  if (selectedProviderIds.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon icon="tabler:language-off" className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{i18n.t("translationHub.noServicesSelected")}</EmptyTitle>
          <EmptyDescription>
            {i18n.t("translationHub.noServicesDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      {selectedProviderIds.map(id => (
        <TranslationCard
          key={id}
          providerId={id}
          isExpanded={expandedById[id] ?? true}
          onExpandedChange={(expanded) => {
            setExpandedById(prev => ({ ...prev, [id]: expanded }))
          }}
        />
      ))}
    </div>
  )
}
