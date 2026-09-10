import { Icon } from "@iconify/react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { useSaveGlossaryTerm } from "./use-glossary"

export function GlossaryAddTermItem() {
  const { mutateAsync: saveTerm, isPending } = useSaveGlossaryTerm()
  const [source, setSource] = useState("")
  const [target, setTarget] = useState("")
  // Deliberately NOT reset after an add: someone entering a run of
  // case-sensitive terms ticks it once. There is no global default for it —
  // the box is right here, and the only place the choice cannot be made per
  // term is a CSV import, which asks separately.
  const [caseSensitive, setCaseSensitive] = useState(false)

  const handleAdd = async () => {
    if (source.trim() === "") return
    const result = await saveTerm({ input: { source, target, caseSensitive } })
    if (result.ok) {
      setSource("")
      setTarget("")
      return
    }
    toastManager.add({
      type: "error",
      title: i18n.t(`options.advanced.glossary.addError.${result.reason}`),
    })
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
