import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { pageTranslateRangeSchema } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** Bare translate-range control. Callers own the surrounding label and layout. */
export function TranslateRangeSelect() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { range } = translateConfig.page

  return (
    <Select
      value={range}
      onValueChange={(nextRange) => {
        if (!nextRange) return
        void setTranslateConfig({ page: { ...translateConfig.page, range: nextRange } })
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue render={<span />}>
          {i18n.t(`options.translation.translateRange.range.${range}`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          {pageTranslateRangeSchema.options.map((item) => (
            <SelectItem key={item} value={item}>
              {i18n.t(`options.translation.translateRange.range.${item}`)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
