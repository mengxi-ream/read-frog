import type { BatchQueueConfig } from "@/types/config/translate"
import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { batchQueueConfigSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MIN_BATCH_CHARACTERS, MIN_BATCH_ITEMS } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

type KeyOfBatchQueueConfig = keyof BatchQueueConfig

export function RequestBatch() {
  return (
    <ConfigCard
      id="request-batch"
      title={i18n.t("options.translation.batchQueueConfig.title")}
      description={i18n.t("options.translation.batchQueueConfig.description")}
    >
      <FieldGroup>
        <BatchNumberSelector property="maxCharactersPerBatch" />
        <BatchNumberSelector property="maxItemsPerBatch" />
      </FieldGroup>
    </ConfigCard>
  )
}

// Resolve labels lazily (thunks) so a runtime UI-language switch re-reads them at render
// instead of freezing the strings at module-import time.
const propertyInfo = {
  maxCharactersPerBatch: {
    label: () => i18n.t("options.translation.batchQueueConfig.maxCharactersPerBatch.title"),
    description: () =>
      i18n.t("options.translation.batchQueueConfig.maxCharactersPerBatch.description"),
  },
  maxItemsPerBatch: {
    label: () => i18n.t("options.translation.batchQueueConfig.maxItemsPerBatch.title"),
    description: () => i18n.t("options.translation.batchQueueConfig.maxItemsPerBatch.description"),
  },
}

const propertyMinValue = {
  maxCharactersPerBatch: MIN_BATCH_CHARACTERS,
  maxItemsPerBatch: MIN_BATCH_ITEMS,
}

function BatchNumberSelector({ property }: { property: KeyOfBatchQueueConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { batchQueueConfig } = translateConfig

  const currentConfigValue = batchQueueConfig[property]
  const minAllowedValue = propertyMinValue[property]

  const info = propertyInfo[property]

  return (
    <Field orientation="responsive">
      <FieldContent className="self-center">
        <FieldLabel htmlFor={`batch-${property}`}>
          {info.label()}
          <HelpTooltip>{info.description()}</HelpTooltip>
        </FieldLabel>
      </FieldContent>
      <Input
        id={`batch-${property}`}
        className="w-40 shrink-0"
        type="number"
        min={minAllowedValue}
        value={currentConfigValue}
        onChange={(e) => {
          const newConfigValue = Number(e.target.value)
          const configParseResult = batchQueueConfigSchema
            .partial()
            .safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            // Persisting is enough: the background watches the stored config
            // and applies queue changes itself (no droppable message).
            void setTranslateConfig({
              ...translateConfig,
              batchQueueConfig: {
                ...translateConfig.batchQueueConfig,
                [property]: newConfigValue,
              },
            })
          } else {
            toastManager.add({
              type: "error",
              title: configParseResult.error?.issues[0]!.message,
            })
          }
        }}
      />
    </Field>
  )
}
