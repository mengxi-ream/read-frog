import type { TranslationMode } from "@/types/config/translate"
import { useAtom, useAtomValue } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { TRANSLATION_MODES } from "@/types/config/translate"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { getTranslationOnlyBlockedReason } from "@/utils/providers/translation-only-gate"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** Bare translation-mode control. Callers own the surrounding label and layout. */
export function TranslationModeSelect() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const config = useAtomValue(configAtom)
  const { mode } = translateConfig
  // translationOnly is unavailable while the page-translate provider has no markup
  // support; the reason names that provider (translation-only-gate.ts).
  const translationOnlyBlockedReason = getTranslationOnlyBlockedReason(config)

  return (
    <Select
      value={mode}
      onValueChange={(nextMode: TranslationMode | null) => {
        if (!nextMode) return
        if (nextMode === "translationOnly" && translationOnlyBlockedReason !== null) return
        void setTranslateConfig({ mode: nextMode })
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue render={<span />}>
          {i18n.t(`options.translation.preference.translationMode.mode.${mode}`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          {TRANSLATION_MODES.map((item) => {
            const blockedReason = item === "translationOnly" ? translationOnlyBlockedReason : null
            return (
              <SelectItem key={item} value={item} disabled={blockedReason !== null}>
                {i18n.t(`options.translation.preference.translationMode.mode.${item}`)}
                {blockedReason !== null && (
                  <Tooltip>
                    {/* A disabled SelectItem is pointer-events-none — which is exactly why
                        the native `title` this replaces never appeared. This hit area opts
                        back in and covers the whole row (the item is `relative`), so the
                        explanation shows wherever the pointer lands. Safe: base-ui blocks
                        selection in the item's own handlers, so the CSS is cosmetic only.
                        Rendered as a span, not the trigger's default <button>: a focusable
                        descendant of a `role="option"` breaks listbox keyboard navigation. */}
                    <TooltipTrigger
                      render={<span className="pointer-events-auto absolute inset-0" />}
                    />
                    {/* Beside the popup, not above it: a top-anchored tooltip covers the
                        other mode row, which is the one the reader has to move to next. */}
                    <TooltipContent side="left">{blockedReason}</TooltipContent>
                  </Tooltip>
                )}
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
