import type Glossary from "@/utils/db/dexie/tables/glossary"
import { usePatternList } from "@/hooks/use-pattern-list"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../../components/config-item"
import { PatternsTable } from "../../../../components/patterns-table"
import { useSetGlossaryPatterns } from "../use-glossary"

/**
 * Which websites this glossary applies to.
 *
 * An empty list means every site — the list restricts rather than permits, so a
 * glossary works the moment it is created. That is not something an empty table
 * can convey on its own, so the description says which of the two states the
 * glossary is currently in.
 */
export function GlossarySitesItem({ glossary }: { glossary: Glossary }) {
  const { mutate: setPatterns } = useSetGlossaryPatterns()
  const { addPattern, removePattern } = usePatternList(glossary.matchPatterns, (patterns) =>
    setPatterns({ id: glossary.id, patterns }),
  )

  return (
    <ConfigItem
      id="glossary-sites"
      orientation="vertical"
      title={i18n.t("options.advanced.glossary.editor.sites.title")}
      description={
        <>
          {i18n.t("options.advanced.glossary.editor.sites.description")}
          {glossary.matchPatterns.length === 0 && (
            <span className="mt-1 block">
              {i18n.t("options.advanced.glossary.editor.sites.allSites")}
            </span>
          )}
        </>
      }
    >
      <PatternsTable
        patterns={glossary.matchPatterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t("options.advanced.glossary.editor.sites.placeholder")}
        tableHeaderText={i18n.t("options.advanced.glossary.editor.sites.header")}
      />
    </ConfigItem>
  )
}
