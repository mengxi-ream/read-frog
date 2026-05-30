import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { useState } from "react"
import { i18n } from "#imports"
import { HelpTooltip } from "@/components/help-tooltip"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Slider } from "@/components/ui/base-ui/slider"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { HOTKEY_ICONS, HOTKEYS } from "@/utils/constants/hotkeys"
import { ConfigCard } from "../../components/config-card"

export function NodeTranslationHotkey() {
  const [translateConfig, setTranslateConfig] = useAtom(
    configFieldsAtomMap.translate,
  )

  const currentVal = translateConfig.node.holdTriggerMs ?? 500
  const [prevHoldTriggerMs, setPrevHoldTriggerMs] = useState(currentVal)
  const [draftHoldTriggerMs, setDraftHoldTriggerMs] = useState(currentVal)

  if (currentVal !== prevHoldTriggerMs) {
    setPrevHoldTriggerMs(currentVal)
    setDraftHoldTriggerMs(currentVal)
  }

  return (
    <ConfigCard
      id="node-translation-hotkey"
      title={i18n.t("options.translation.nodeTranslationHotkey.title")}
      description={i18n.t("options.translation.nodeTranslationHotkey.description")}
    >
      <div className="flex flex-col gap-4">
        <Field orientation="horizontal">
          <FieldContent className="self-center">
            <FieldLabel htmlFor="node-translation-hotkey-toggle">
              {i18n.t("options.translation.nodeTranslationHotkey.enable")}
            </FieldLabel>
          </FieldContent>
          <Switch
            id="node-translation-hotkey-toggle"
            checked={translateConfig.node.enabled}
            onCheckedChange={(checked) => {
              void setTranslateConfig(
                deepmerge(translateConfig, { node: { enabled: checked } }),
              )
            }}
          />
        </Field>
        <Select
          value={translateConfig.node.hotkey}
          onValueChange={(value: typeof HOTKEYS[number] | null) => {
            if (!value)
              return
            void setTranslateConfig(
              deepmerge(translateConfig, { node: { hotkey: value } }),
            )
          }}
          disabled={!translateConfig.node.enabled}
        >
          <SelectTrigger className={`w-full ${!translateConfig.node.enabled ? "opacity-50 pointer-events-none" : ""}`}>
            <SelectValue render={<span />}>
              {HOTKEY_ICONS[translateConfig.node.hotkey]}
              {" "}
              {i18n.t(`hotkey.${translateConfig.node.hotkey}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {HOTKEYS.map(item => (
                <SelectItem key={item} value={item}>
                  {HOTKEY_ICONS[item]}
                  {" "}
                  {i18n.t(`hotkey.${item}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {translateConfig.node.enabled && translateConfig.node.hotkey === "clickAndHold" && (
          <Field orientation="responsive" className="mt-2 flex flex-col gap-2">
            <FieldContent className="self-center">
              <FieldLabel htmlFor="node-translation-hold-trigger-ms" className="flex items-center gap-1">
                {i18n.t("options.translation.nodeTranslationHotkey.holdTriggerMs.title")}
                <HelpTooltip>
                  {i18n.t("options.translation.nodeTranslationHotkey.holdTriggerMs.description")}
                </HelpTooltip>
              </FieldLabel>
            </FieldContent>
            <div className="w-full flex items-center gap-4">
              <Slider
                id="node-translation-hold-trigger-ms"
                min={50}
                max={750}
                step={10}
                value={draftHoldTriggerMs}
                onValueChange={(value) => {
                  setDraftHoldTriggerMs(value as number)
                }}
                onValueCommitted={(value) => {
                  void setTranslateConfig(
                    deepmerge(translateConfig, {
                      node: { holdTriggerMs: value as number },
                    }),
                  )
                }}
                className="flex-1"
              />
              <span className="w-16 text-sm text-right shrink-0 font-mono">
                <span className="font-bold">{draftHoldTriggerMs}</span>
                <span className="text-muted-foreground text-xs ml-0.5 font-normal">ms</span>
              </span>
            </div>
          </Field>
        )}
      </div>
    </ConfigCard>
  )
}
