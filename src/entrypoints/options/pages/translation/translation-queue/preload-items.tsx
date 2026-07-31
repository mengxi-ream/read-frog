import type { PreloadConfig } from "@/types/config/translate"
import { useAtom } from "jotai"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { preloadConfigSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  MAX_PRELOAD_MARGIN,
  MAX_PRELOAD_THRESHOLD,
  MIN_PRELOAD_MARGIN,
  MIN_PRELOAD_THRESHOLD,
} from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"

type KeyOfPreloadConfig = keyof PreloadConfig

/** How far ahead of the reader translation runs — the distance, and how much of a paragraph counts as reached. */
export function PreloadItems() {
  return (
    <>
      <ConfigItem
        id="preload-config"
        title={i18n.t("options.translation.preloadConfig.title")}
        description={i18n.t("options.translation.preloadConfig.margin.description")}
      >
        <PreloadNumberInput property="margin" />
      </ConfigItem>
      <ConfigItem description={i18n.t("options.translation.preloadConfig.threshold.description")}>
        <PreloadNumberInput property="threshold" />
      </ConfigItem>
    </>
  )
}

const propertyConstraints = {
  margin: { min: MIN_PRELOAD_MARGIN, max: MAX_PRELOAD_MARGIN, step: 100 },
  threshold: { min: MIN_PRELOAD_THRESHOLD, max: MAX_PRELOAD_THRESHOLD, step: 0.1 },
}

function PreloadNumberInput({ property }: { property: KeyOfPreloadConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { preload } = translateConfig.page
  const constraints = propertyConstraints[property]

  return (
    <Input
      className="w-24 shrink-0"
      type="number"
      min={constraints.min}
      max={constraints.max}
      step={constraints.step}
      value={preload[property]}
      onChange={(e) => {
        const newConfigValue = Number(e.target.value)
        const configParseResult = preloadConfigSchema
          .partial()
          .safeParse({ [property]: newConfigValue })
        if (configParseResult.success) {
          void setTranslateConfig({
            page: {
              ...translateConfig.page,
              preload: { ...translateConfig.page.preload, [property]: newConfigValue },
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
