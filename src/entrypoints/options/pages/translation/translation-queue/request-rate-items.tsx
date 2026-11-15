import type { RequestQueueConfig } from "@/types/config/translate"
import { useAtom } from "jotai"
import { useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { requestQueueConfigSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
  MIN_TRANSLATE_CAPACITY,
  MIN_TRANSLATE_RATE,
} from "@/utils/constants/translate"
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

/** How long one request may take before it is given up on and retried. */
export function RequestTimeoutItem() {
  return (
    <ConfigItem
      id="request-timeout"
      title={i18n.t("options.translation.translationQueue.requestTimeout.title")}
      description={i18n.t("options.translation.translationQueue.requestTimeout.description")}
    >
      <TranslateNumberInput property="timeoutMs" />
    </ConfigItem>
  )
}

// The input shows `value / unit`: the timeout is stored in milliseconds and
// typed in seconds.
const propertyInputConstraints: Record<
  KeyOfRequestQueueConfig,
  { min: number; max?: number; step: string; unit: number }
> = {
  capacity: { min: MIN_TRANSLATE_CAPACITY, step: "any", unit: 1 },
  rate: { min: MIN_TRANSLATE_RATE, step: "any", unit: 1 },
  timeoutMs: {
    min: MIN_REQUEST_TIMEOUT_MS / 1000,
    max: MAX_REQUEST_TIMEOUT_MS / 1000,
    step: "1",
    unit: 1000,
  },
}

function toConfigValue(rawValue: string, unit: number): number {
  const value = Number(rawValue) * unit
  // Whole milliseconds: 1.1 s × 1000 is 1100.0000000000002 in floating point.
  return unit === 1 ? value : Math.round(value)
}

function TranslateNumberInput({ property }: { property: KeyOfRequestQueueConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const { requestQueueConfig } = translateConfig

  const currentConfigValue = requestQueueConfig[property]
  const { min, max, step, unit } = propertyInputConstraints[property]
  const currentInputValue = String(currentConfigValue / unit)

  const [inputValue, setInputValue] = useState(currentInputValue)
  const [prevConfigValue, setPrevConfigValue] = useState(currentConfigValue)

  // Reset the draft input when the config value changes externally
  if (prevConfigValue !== currentConfigValue) {
    setPrevConfigValue(currentConfigValue)
    setInputValue(currentInputValue)
  }

  return (
    <Input
      className="w-24 shrink-0"
      type="number"
      min={min}
      max={max}
      step={step}
      value={inputValue}
      onChange={(e) => {
        const rawValue = e.target.value
        setInputValue(rawValue)
        const newConfigValue = toConfigValue(rawValue, unit)
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
        const newConfigValue = toConfigValue(inputValue, unit)
        const configParseResult = requestQueueConfigSchema
          .partial()
          .safeParse({ [property]: newConfigValue })
        if (inputValue === "" || !configParseResult.success) {
          toastManager.add({
            type: "error",
            title: configParseResult.error!.issues[0]!.message,
          })
          setInputValue(currentInputValue)
        }
      }}
    />
  )
}
