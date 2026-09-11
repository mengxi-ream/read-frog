import type { GlossaryTargetLang } from "@/utils/glossary/target-language"
import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { useMemo, useState } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { getGlossaryTargetLanguageItems } from "@/components/language-combobox-options"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { defaultGlossaryTargetLang } from "@/utils/glossary/target-language"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { saveTermErrorTitle } from "./save-term-error"
import { useSaveGlossaryTerm } from "./use-glossary"

export function GlossaryAddTermItem({ glossaryId }: { glossaryId: string }) {
  const { mutateAsync: saveTerm, isPending } = useSaveGlossaryTerm(glossaryId)
  const language = useAtomValue(configFieldsAtomMap.language)
  const [source, setSource] = useState("")
  const [target, setTarget] = useState("")
  // Null is "the user has not answered", and the answer is then derived from the
  // translation field: a wording belongs to the language it is written in, and a
  // term with no wording belongs to all of them. Once they do answer it is
  // theirs and survives an add, like the case box below: someone entering a run
  // of Japanese terms picks it once.
  const [chosenLang, setChosenLang] = useState<GlossaryTargetLang | null>(null)
  const targetLang = chosenLang ?? defaultGlossaryTargetLang(target, language.targetCode)
  const languageItems = useMemo(
    () => getGlossaryTargetLanguageItems(i18n.t("options.advanced.glossary.allLanguages")),
    [],
  )
  // Deliberately NOT reset after an add: someone entering a run of
  // case-sensitive terms ticks it once. There is no global default for it —
  // the box is right here, and the only place the choice cannot be made per
  // term is a CSV import, which asks separately.
  const [caseSensitive, setCaseSensitive] = useState(false)

  const handleAdd = async () => {
    if (source.trim() === "") return
    const result = await saveTerm({ input: { source, target, caseSensitive, targetLang } })
    if (result.ok) {
      setSource("")
      setTarget("")
      return
    }
    toastManager.add({ type: "error", title: saveTermErrorTitle(result.reason) })
  }

  const submitOnEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") void handleAdd()
  }

  return (
    <ConfigItem
      id="glossary-add-term"
      orientation="vertical"
      title={i18n.t("options.advanced.glossary.addTerm.title")}
      description={i18n.t("options.advanced.glossary.addTerm.description")}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={i18n.t("options.advanced.glossary.sourcePlaceholder")}
            className="min-w-40 flex-1"
            onKeyDown={submitOnEnter}
          />
          <Input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={i18n.t("options.advanced.glossary.targetPlaceholder")}
            className="min-w-40 flex-1"
            onKeyDown={submitOnEnter}
          />
          {/* Which language this wording is for. A term only ever reaches a
              prompt whose target language matches, so this is not decoration. */}
          <LanguageCombobox
            // Default size, not `sm`: the inputs and the Add button beside it are
            // `h-8` and `sm` is `h-7`, which left the row a pixel out of line.
            items={languageItems}
            value={targetLang}
            onValueChange={setChosenLang}
          />
          <Button disabled={isPending || source.trim() === ""} onClick={() => void handleAdd()}>
            <Icon icon="tabler:plus" />
            {i18n.t("options.advanced.glossary.add")}
          </Button>
        </div>
        {/* Its own line rather than squeezed between the fields: it qualifies the
            term above it, and inline it read as a third input. */}
        <label className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox checked={caseSensitive} onCheckedChange={setCaseSensitive} />
          {i18n.t("options.advanced.glossary.caseSensitive")}
        </label>
      </div>
    </ConfigItem>
  )
}
