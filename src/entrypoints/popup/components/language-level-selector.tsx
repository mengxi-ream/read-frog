import { LangLevel } from "@/types/config/languages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { configFields } from "@/utils/atoms/config";
import { useAtom } from "jotai";

export default function LanguageLevelSelector() {
  const [language, setLanguage] = useAtom(configFields.language);

  return (
    <div className="flex items-center gap-2 justify-between">
      <span className="font-medium text-[13px]">{i18n.t("languageLevel")}</span>
      <Select
        value={language.level}
        onValueChange={(value: LangLevel) => setLanguage({ level: value })}
      >
        <SelectTrigger
          size="sm"
          className="outline-none cursor-pointer bg-input/50 hover:bg-input !h-7 w-29 pl-2.5 pr-1.5"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="beginner">
            {i18n.t("languageLevels.beginner")}
          </SelectItem>
          <SelectItem value="intermediate">
            {i18n.t("languageLevels.intermediate")}
          </SelectItem>
          <SelectItem value="advanced">
            {i18n.t("languageLevels.advanced")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
