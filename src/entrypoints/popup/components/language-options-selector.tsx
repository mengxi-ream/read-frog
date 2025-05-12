import { useAtom } from "jotai";
import { ArrowRight, ChevronDown } from "lucide-react";

import {
  LangCodeISO6393,
  langCodeISO6393,
  langCodeToEnglishName,
} from "@/types/config/languages";
import { configFields } from "@/utils/atoms/config";

export default function LanguageOptionsSelector() {
  const [language, setLanguage] = useAtom(configFields.language);

  const handleSourceLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLangCode = e.target.value as LangCodeISO6393;
    setLanguage({ sourceCode: newLangCode });
  };

  const handleTargetLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLangCode = e.target.value as LangCodeISO6393;
    setLanguage({ targetCode: newLangCode });
  };

  console.log("language", language);

  return (
    <div className="flex items-center gap-2">
      <div className="bg-input/50 hover:bg-input border-input relative inline-flex h-13 w-32 items-center justify-between rounded-lg border shadow-xs">
        <span className="pt-5 pl-4 text-sm text-neutral-500">
          {language.sourceCode === "auto"
            ? i18n.t("popup.autoLang")
            : i18n.t("popup.sourceLang")}
        </span>
        <ChevronDown
          className="absolute right-2 h-5 w-5 text-neutral-400 dark:text-neutral-600"
          strokeWidth={1.5}
        />
        <select
          className="insect-0 absolute w-32 cursor-pointer appearance-none truncate bg-transparent pr-8 pb-4 pl-4 text-base font-medium outline-none"
          value={language.sourceCode}
          onChange={handleSourceLangChange}
        >
          <option value="auto">
            {langCodeToEnglishName[language.detectedCode]} (auto)
          </option>
          {langCodeISO6393.options.map((key) => (
            <option key={key} value={key}>
              {langCodeToEnglishName[key]}
            </option>
          ))}
        </select>
      </div>
      <ArrowRight className="h-4 w-4 text-neutral-500" strokeWidth={2} />
      <div className="bg-input/50 hover:bg-input border-input relative inline-flex h-13 w-32 items-center justify-between rounded-lg border shadow-xs">
        <span className="pt-5 pl-4 text-sm text-neutral-500">
          {i18n.t("popup.targetLang")}
        </span>
        <ChevronDown
          className="absolute right-2 h-5 w-5 text-neutral-400 dark:text-neutral-600"
          strokeWidth={1.5}
        />
        <select
          className="insect-0 absolute w-32 cursor-pointer appearance-none truncate bg-transparent pr-8 pb-4 pl-4 text-base font-medium outline-none"
          value={language.targetCode}
          onChange={handleTargetLangChange}
        >
          {langCodeISO6393.options.map((key) => (
            <option key={key} value={key}>
              {langCodeToEnglishName[key]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
