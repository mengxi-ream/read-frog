import type { RequestQueueConfig } from "@/types/config/translate"
import { useAtom } from "jotai"
import { useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { requestQueueConfigSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"

type KeyOfRequestQueueConfig = keyof RequestQueueConfig

/** How fast requests leave: a burst allowance, then the steady pace it refills at. */
export function RequestRateItems() {
  return (
    <>
      <ConfigItem
        id="request-rate"
        title={i18n.t("options.translation.translationQueue.requestQueueConfig.title")}
        description={i18n.t(
          "options.translation.translationQueue.requestQueueConfig.capacity.description",
        )}
      >
        <TranslateNumberInput property="capacity" />
      </ConfigItem>
      <ConfigItem
        description={i18n.t(
          "options.translation.translationQueue.requestQueueConfig.rate.description",
        )}
      >
        <TranslateNumberInput property="rate" />
      </ConfigItem>
    </>
  )
}

const propertyMinAllowedValue = {
  capacity: MIN_TRANSLATE_CAPACITY,
  rate: MIN_TRANSLATE_RATE,
}

function TranslateNumberInput({ property }: { property: KeyOfRequestQueueConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { requestQueueConfig } = translateConfig

  const currentConfigValue = requestQueueConfig[property]
  const minAllowedValue = propertyMinAllowedValue[property]

  const [inputValue, setInputValue] = useState(String(currentConfigValue))
  const [prevConfigValue, setPrevConfigValue] = useState(currentConfigValue)

  // Reset the draft input when the config value changes externally
  if (prevConfigValue !== currentConfigValue) {
    setPrevConfigValue(currentConfigValue)
    setInputValue(String(currentConfigValue))
  }

  return (
    <Input
      className="w-24 shrink-0"
      type="number"
      min={minAllowedValue}
      step="any"
      value={inputValue}
      onChange={(e) => {
        const rawValue = e.target.value
        setInputValue(rawValue)
        const newConfigValue = Number(rawValue)
        const configParseResult = requestQueueConfigSchema
          .partial()
          .safeParse({ [property]: newConfigValue })
        if (rawValue !== "" && configParseResult.success) {
          // Persisting is enough: the background watches the stored config
          // and applies queue changes itself (no droppable message).
          void setTranslateConfig({
            requestQueueConfig: {
              ...translateConfig.requestQueueConfig,
              [property]: newConfigValue,
            },
          })
        }
      }}
      onBlur={() => {
        const newConfigValue = Number(inputValue)
        const configParseResult = requestQueueConfigSchema
          .partial()
          .safeParse({ [property]: newConfigValue })
        if (inputValue === "" || !configParseResult.success) {
          toastManager.add({
            type: "error",
            title: configParseResult.error!.issues[0]!.message,
          })
          setInputValue(String(currentConfigValue))
        }
      }}
    />
  )
}
