import type { RequestQueueConfig } from "@/types/config/translate"
import { useAtom } from "jotai"
import { useState } from "react"
import { toast } from "sonner"
import { HelpTooltip } from "@/components/help-tooltip"
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { requestQueueConfigSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MIN_TRANSLATE_CAPACITY, MIN_TRANSLATE_RATE } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { ConfigCard } from "../../components/config-card"

type KeyOfRequestQueueConfig = keyof RequestQueueConfig

export function RequestRate() {
  return (
    <ConfigCard
      id="request-rate"
      title={i18n.t("options.translation.requestQueueConfig.title")}
      description={(
        <div>
          {i18n.t("options.translation.requestQueueConfig.firstOnDescription")}
          <a target="_blank" rel="noopener noreferrer" href="https://en.wikipedia.org/wiki/Token_bucket" aria-label="Learn more about the Token Bucket algorithm on Wikipedia"> Token Bucket </a>
          {i18n.t("options.translation.requestQueueConfig.lastOnDescription")}
        </div>
      )}
    >
      <FieldGroup>
        <TranslateNumberSelector property="capacity" />
        <TranslateNumberSelector property="rate" />
      </FieldGroup>
    </ConfigCard>
  )
}

// Resolve labels lazily (thunks) so a runtime UI-language switch re-reads them at render
// instead of freezing the strings at module-import time.
const propertyInfo = {
  capacity: {
    label: () => i18n.t("options.translation.requestQueueConfig.capacity.title"),
    description: () => i18n.t("options.translation.requestQueueConfig.capacity.description"),
  },
  rate: {
    label: () => i18n.t("options.translation.requestQueueConfig.rate.title"),
    description: () => i18n.t("options.translation.requestQueueConfig.rate.description"),
  },
}

const propertyMinAllowedValue = {
  capacity: MIN_TRANSLATE_CAPACITY,
  rate: MIN_TRANSLATE_RATE,
}

function TranslateNumberSelector({ property }: { property: KeyOfRequestQueueConfig }) {
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

  const info = propertyInfo[property]

  return (
    <Field orientation="responsive">
      <FieldContent className="self-center">
        <FieldLabel htmlFor={`translate-${property}`}>
          {info.label()}
          <HelpTooltip>{info.description()}</HelpTooltip>
        </FieldLabel>
      </FieldContent>
      <Input
        id={`translate-${property}`}
        className="w-40 shrink-0"
        type="number"
        min={minAllowedValue}
        step="any"
        value={inputValue}
        onChange={(e) => {
          const rawValue = e.target.value
          setInputValue(rawValue)
          const newConfigValue = Number(rawValue)
          const configParseResult = requestQueueConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (rawValue !== "" && configParseResult.success) {
            void setTranslateConfig({
              ...translateConfig,
              requestQueueConfig: {
                ...translateConfig.requestQueueConfig,
                [property]: newConfigValue,
              },
            })
            void sendMessage("setTranslateRequestQueueConfig", {
              [property]: newConfigValue,
            })
          }
        }}
        onBlur={() => {
          const newConfigValue = Number(inputValue)
          const configParseResult = requestQueueConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (inputValue === "" || !configParseResult.success) {
            toast.error(configParseResult.error?.issues[0].message)
            setInputValue(String(currentConfigValue))
          }
        }}
      />
    </Field>
  )
}
