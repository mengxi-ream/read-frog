import type Glossary from "@/utils/db/dexie/tables/glossary"
import { useEffect, useEffectEvent, useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  MAX_GLOSSARY_DESCRIPTION_LENGTH,
  MAX_GLOSSARY_NAME_LENGTH,
} from "@/utils/constants/glossary"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../../components/config-item"
import { useUpdateGlossaryMeta } from "../use-glossary"

/**
 * The glossary's name and description.
 *
 * Written on a debounce rather than on blur so nothing is lost by navigating
 * away mid-word. Neither field takes part in matching, which is why saving them
 * does not bump the glossary revision and make every open page recompile —
 * see `updateGlossaryMeta`.
 */
export function GlossaryDetailsItem({ glossary }: { glossary: Glossary }) {
  const { mutate: updateMeta } = useUpdateGlossaryMeta()
  const [name, setName] = useState(glossary.name)
  const [description, setDescription] = useState(glossary.description)

  const debouncedName = useDebouncedValue(name, 500)
  const debouncedDescription = useDebouncedValue(description, 500)

  const save = useEffectEvent(() => {
    if (debouncedName === glossary.name && debouncedDescription === glossary.description) return
    updateMeta({ id: glossary.id, name: debouncedName, description: debouncedDescription })
  })
  useEffect(() => {
    save()
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- the dependencies are re-run triggers, not values the effect body reads
  }, [debouncedName, debouncedDescription])

  return (
    <ConfigItem
      id="glossary-details"
      orientation="vertical"
      title={i18n.t("options.advanced.glossary.editor.details.title")}
    >
      <div className="flex flex-col gap-2">
        <Input
          value={name}
          maxLength={MAX_GLOSSARY_NAME_LENGTH}
          // The name is required, and `updateGlossaryMeta` refuses to store an
          // empty one. Snapping back on blur is how that rule shows itself —
          // otherwise the field would sit empty while the row above still
          // carried the old name.
          onBlur={() => setName(glossary.name)}
          // The SAME string the header falls back to, so an unnamed glossary
          // reads the same in both places instead of looking like a field
          // someone emptied. Nothing is stored: a default name written at
          // creation would be frozen in whatever UI language was current then.
          placeholder={i18n.t("options.advanced.glossary.untitled")}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          value={description}
          maxLength={MAX_GLOSSARY_DESCRIPTION_LENGTH}
          placeholder={i18n.t("options.advanced.glossary.editor.details.descriptionPlaceholder")}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </ConfigItem>
  )
}
