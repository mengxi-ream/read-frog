import type { BatchQueueConfig } from "@/types/config/translate"
import { useAtom } from "jotai"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { batchQueueConfigSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MIN_BATCH_CHARACTERS, MIN_BATCH_ITEMS } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { BatchSavingsNote } from "../../../components/batch-savings-note"
import { ConfigItem } from "../../../components/config-item"

type KeyOfBatchQueueConfig = keyof BatchQueueConfig

/** How many subtitle lines ride along in one request — the two limits that cap a batch. */
export function BatchTranslationItems() {
  return (
    <>
      <ConfigItem
        id="subtitles-request-batch"
        title={
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {i18n.t("options.videoSubtitles.subtitlesQueue.batchQueueConfig.title")}
            <BatchSavingsNote />
          </span>
        }
        description={i18n.t(
          "options.videoSubtitles.subtitlesQueue.batchQueueConfig.maxCharactersPerBatch.description",
        )}
      >
        <BatchNumberInput property="maxCharactersPerBatch" />
      </ConfigItem>
      <ConfigItem
        description={i18n.t(
          "options.videoSubtitles.subtitlesQueue.batchQueueConfig.maxItemsPerBatch.description",
        )}
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
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(
    configFieldsAtomMap.videoSubtitles,
  )
  const { batchQueueConfig } = videoSubtitlesConfig

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
          void setVideoSubtitlesConfig({
            batchQueueConfig: {
              ...videoSubtitlesConfig.batchQueueConfig,
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
