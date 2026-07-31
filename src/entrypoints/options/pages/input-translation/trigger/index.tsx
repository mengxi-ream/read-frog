import { useAtom } from "jotai"
import { useState } from "react"
import { Input } from "@/components/ui/base-ui/input"
import { Switch } from "@/components/ui/base-ui/switch"
import { toastManager } from "@/components/ui/base-ui/toast"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

const MIN_THRESHOLD = 100
const MAX_THRESHOLD = 1000

/**
 * Whether the feature runs, and how quickly the three space presses have to land. The keys
 * themselves are fixed — the only thing to set is how close together they count as a trigger.
 */
export function TriggerSection() {
  const [inputTranslation, setInputTranslation] = useAtom(configFieldsAtomMap.inputTranslation)

  return (
    <ConfigSection
      id="input-translation-trigger"
      title={i18n.t("options.inputTranslation.trigger.title")}
    >
      <ConfigItem
        title={i18n.t("options.inputTranslation.trigger.enable.title")}
        description={i18n.t("options.inputTranslation.trigger.enable.description")}
      >
        <Switch
          checked={inputTranslation.enabled}
          onCheckedChange={(checked) => {
            void setInputTranslation({ ...inputTranslation, enabled: checked })
          }}
        />
      </ConfigItem>
      <ConfigItem
        id="input-translation-threshold"
        title={i18n.t("options.inputTranslation.trigger.threshold.title")}
        description={i18n.t("options.inputTranslation.trigger.threshold.description")}
      >
        <ThresholdInput
          value={inputTranslation.timeThreshold}
          onValue={(timeThreshold) => {
            void setInputTranslation({ ...inputTranslation, timeThreshold })
          }}
        />
      </ConfigItem>
    </ConfigSection>
  )
}

/**
 * Typing a new number means passing through half-written ones — "10" on the way to "100" — so
 * the draft lives here and only reaches the config once it is in range. Leaving the field with
 * something unusable in it says so and puts the last good value back.
 */
function ThresholdInput({ value, onValue }: { value: number; onValue: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)

  // Reset the draft when the config value changes from somewhere else
  if (prevValue !== value) {
    setPrevValue(value)
    setDraft(String(value))
  }

  return (
    <Input
      className="w-24 shrink-0"
      type="number"
      min={MIN_THRESHOLD}
      max={MAX_THRESHOLD}
      step={50}
      value={draft}
      onChange={(e) => {
        const rawValue = e.target.value
        setDraft(rawValue)
        const nextValue = Number(rawValue)
        if (rawValue !== "" && nextValue >= MIN_THRESHOLD && nextValue <= MAX_THRESHOLD) {
          onValue(nextValue)
        }
      }}
      onBlur={() => {
        const nextValue = Number(draft)
        if (draft !== "" && nextValue >= MIN_THRESHOLD && nextValue <= MAX_THRESHOLD) {
          // Drops the leading zeros a typed number can carry: 0300 → 300
          setDraft(String(nextValue))
          return
        }
        toastManager.add({
          type: "error",
          title: i18n.t("options.inputTranslation.trigger.threshold.error", [
            MIN_THRESHOLD,
            MAX_THRESHOLD,
          ]),
        })
        setDraft(String(value))
      }}
    />
  )
}
