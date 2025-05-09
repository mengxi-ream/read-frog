// import { onMessage } from "@/utils/message";
import {
  LangCodeISO6393,
  langCodeToEnglishName,
  langLevel,
  LangLevel,
} from "@/types/config/languages";
import { useAtom, useSetAtom } from "jotai";
import { ArrowRight, X } from "lucide-react";
import { isSideOpenAtom } from "../../atoms";
import { cn } from "@/utils/tailwind";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { shadowWrapper } from "../..";
import { SelectGroup } from "@radix-ui/react-select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PROVIDER_ITEMS } from "@/utils/constants/config";
import { configFields } from "@/utils/atoms/config";

export const TopBar = ({ className }: { className?: string }) => {
  const setIsSideOpen = useSetAtom(isSideOpenAtom);

  return (
    <div className={cn("flex justify-between items-start", className)}>
      <div className="flex text-sm gap-x-2 items-center">
        <SourceLangSelect />
        <ArrowRight size={12} strokeWidth={1} className="-mx-1" />
        <TargetLangSelect />
        {/* <div className="flex items-center h-7 gap-2 px-2 border rounded-md border-border hover:bg-muted">
          <div className="w-1 h-1 rounded-full bg-orange-500"></div>
          <span className="">{i18n.t(`languageLevels.${langLevel}`)}</span>
        </div> */}
        <LangLevelSelect />
        <ProviderSelect />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 rounded-full p-0.5 h-4 w-4 cursor-pointer"
            onClick={() => setIsSideOpen(false)}
          >
            <X strokeWidth={1.2} className="text-neutral-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent container={shadowWrapper} side="left">
          <p>Close</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

const ProviderSelect = () => {
  const [provider, setProvider] = useAtom(configFields.provider);

  return (
    <Select value={provider} onValueChange={setProvider}>
      <SelectTrigger
        hideChevron
        className="!size-7 p-0 flex items-center justify-center"
      >
        <img
          src={PROVIDER_ITEMS[provider].logo}
          alt={provider}
          className="size-4 rounded-full border bg-white"
        />
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t("translateService")}</SelectLabel>
          {Object.entries(PROVIDER_ITEMS).map(([provider, { logo, name }]) => (
            <SelectItem key={provider} value={provider}>
              <div className="flex items-center gap-x-2">
                <img
                  src={logo}
                  alt={name}
                  className="size-4 rounded-full border bg-white"
                />
                <span>{name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

const LangLevelSelect = () => {
  const [language, setLanguage] = useAtom(configFields.language);

  return (
    <Select
      value={language.level}
      onValueChange={(newLevel: LangLevel) => setLanguage({ level: newLevel })}
    >
      <SelectTrigger
        hideChevron
        className="flex items-center !h-7 gap-2 px-2 border rounded-md border-border w-auto"
      >
        <div className="w-1 h-1 rounded-full bg-orange-500 shrink-0"></div>
        <div className="min-w-0 max-w-16 truncate">
          {i18n.t(`languageLevels.${language.level}`)}
        </div>
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t("languageLevel")}</SelectLabel>
          {langLevel.options.map((level) => (
            <SelectItem key={level} value={level}>
              {i18n.t(`languageLevels.${level}`)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

const TargetLangSelect = () => {
  const [language, setLanguage] = useAtom(configFields.language);

  return (
    <Select
      value={language.targetCode}
      onValueChange={(newTargetCode: LangCodeISO6393) =>
        setLanguage({ targetCode: newTargetCode })
      }
    >
      <SelectTrigger
        hideChevron
        className="flex items-center !h-7 gap-2 px-2 border rounded-md border-border w-auto"
      >
        <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0"></div>
        <div className="min-w-0 max-w-16 truncate">
          {langCodeToEnglishName[language.targetCode]}
        </div>
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t("side.targetLang")}</SelectLabel>
          {Object.entries(langCodeToEnglishName).map(([langCode, name]) => (
            <SelectItem key={langCode} value={langCode}>
              {name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

const SourceLangSelect = () => {
  const [language, setLanguage] = useAtom(configFields.language);

  return (
    <Select
      value={language.sourceCode}
      onValueChange={(newSourceCode: LangCodeISO6393 | "auto") =>
        setLanguage({ sourceCode: newSourceCode })
      }
    >
      <SelectTrigger
        hideChevron
        className="flex items-center !h-7 gap-2 px-2 border rounded-md border-border w-auto"
      >
        <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0"></div>
        <div className="min-w-0 max-w-16 truncate">
          {language.sourceCode === "auto"
            ? langCodeToEnglishName[language.detectedCode]
            : langCodeToEnglishName[language.sourceCode]}
        </div>
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t("side.sourceLang")}</SelectLabel>
          <SelectItem value="auto">
            {langCodeToEnglishName[language.detectedCode]}
            <span className="text-xs bg-neutral-200 dark:bg-neutral-800 rounded-full px-1">
              auto
            </span>
          </SelectItem>
          {Object.entries(langCodeToEnglishName).map(([langCode, name]) => (
            <SelectItem key={langCode} value={langCode}>
              {name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
