import type Glossary from "@/utils/db/dexie/tables/glossary"
import { Switch } from "@/components/ui/base-ui/switch"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../../components/config-item"
import { useSetGlossaryEnabled } from "../use-glossary"

/** Same switch as the one on the list row, for whoever got here first. */
export function GlossaryEditorEnableItem({ glossary }: { glossary: Glossary }) {
  const { mutate: setEnabled } = useSetGlossaryEnabled()

  return (
    <ConfigItem
      id="glossary-editor-enabled"
      title={i18n.t("options.advanced.glossary.editor.enable.title")}
      description={i18n.t("options.advanced.glossary.editor.enable.description")}
    >
      <Switch
        checked={glossary.enabled}
        onCheckedChange={(enabled) => setEnabled({ id: glossary.id, enabled })}
      />
    </ConfigItem>
  )
}
