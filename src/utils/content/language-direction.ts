import type { LanguageTag } from "@read-frog/definitions"
import { getLanguageDirection } from "@read-frog/definitions"

interface LanguageDirectionAndLang {
  dir: "ltr" | "rtl"
  lang: string
}

export function getLanguageDirectionAndLang(targetCode: LanguageTag): LanguageDirectionAndLang {
  return { dir: getLanguageDirection(targetCode), lang: targetCode }
}
