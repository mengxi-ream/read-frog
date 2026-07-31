import type { InputTranslationLang } from "@/types/config/config"
import { langCodeISO6393Schema } from "@read-frog/definitions"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { getLanguageLabel } from "@/utils/language-labels"
import { cn } from "@/utils/styles/utils"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/**
 * One side of the pair, at the size every other settings select renders at. The caller sizes
 * the trigger — the label it has to hold is a language's name, which the caller knows more
 * about fitting than this does.
 */
export function LangSelect({
  value,
  onValueChange,
  getDisplayLabel,
  className,
}: {
  value: InputTranslationLang
  onValueChange: (value: InputTranslationLang) => void
  getDisplayLabel: (value: InputTranslationLang) => string
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as InputTranslationLang)}>
      <SelectTrigger size="sm" className={cn("w-full min-w-0", className)}>
        <SelectValue render={<span className="min-w-0 flex-1" />}>
          <span className="block min-w-0 truncate">{getDisplayLabel(value)}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-64" {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          <SelectItem value="targetCode">{getDisplayLabel("targetCode")}</SelectItem>
          <SelectItem value="sourceCode">{getDisplayLabel("sourceCode")}</SelectItem>
          {langCodeISO6393Schema.options.map((code) => (
            <SelectItem key={code} value={code}>
              {getLanguageLabel(code)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
