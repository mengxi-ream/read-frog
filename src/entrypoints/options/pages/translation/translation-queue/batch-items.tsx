import type { BatchQueueConfig } from "@/types/config/translate"
import { useAtom } from "jotai"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { batchQueueConfigSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MIN_BATCH_CHARACTERS, MIN_BATCH_ITEMS } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"

type KeyOfBatchQueueConfig = keyof BatchQueueConfig

/** How much text rides along in one request — the two limits that cap a batch. */
export function BatchTranslationItems() {
  return (
    <>
      <ConfigItem
        id="request-batch"
        title={i18n.t("options.translation.batchQueueConfig.title")}
        description={i18n.t(
          "options.translation.batchQueueConfig.maxCharactersPerBatch.description",
        )}
      >
        <BatchNumberInput property="maxCharactersPerBatch" />
      </ConfigItem>
      <ConfigItem
        description={i18n.t("options.translation.batchQueueConfig.maxItemsPerBatch.description")}
      >
        <BatchNumberInput property="maxItemsPerBatch" />
      </ConfigItem>
    </>
  )
}

const propertyMinValue = {
  maxCharactersPerBatch: MIN_BATCH_CHARACTERS,
  maxItemsPerBatch: MIN_BATCH_ITEMS,
}

function BatchNumberInput({ property }: { property: KeyOfBatchQueueConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { batchQueueConfig } = translateConfig

  return (
    <Input
      className="w-24 shrink-0"
      type="number"
      min={propertyMinValue[property]}
      value={batchQueueConfig[property]}
      onChange={(e) => {
        const newConfigValue = Number(e.target.value)
        const configParseResult = batchQueueConfigSchema
          .partial()
          .safeParse({ [property]: newConfigValue })
        if (configParseResult.success) {
          // Persisting is enough: the background watches the stored config
          // and applies queue changes itself (no droppable message).
          void setTranslateConfig({
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
  )
}
