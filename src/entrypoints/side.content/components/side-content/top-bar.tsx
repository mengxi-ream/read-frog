// import { onMessage } from "@/utils/message";
import { useAtom, useSetAtom } from "jotai";
import { ArrowRight, X } from "lucide-react";

import { SelectGroup } from "@radix-ui/react-select";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LangCodeISO6393,
  LangLevel,
  langCodeToEnglishName,
  langLevel,
} from "@/types/config/languages";
import { configFields } from "@/utils/atoms/config";
import { PROVIDER_ITEMS } from "@/utils/constants/config";
import { cn } from "@/utils/tailwind";

import { shadowWrapper } from "../..";
import { isSideOpenAtom } from "../../atoms";

export const TopBar = ({ className }: { className?: string }) => {
  const setIsSideOpen = useSetAtom(isSideOpenAtom);

  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="flex items-center gap-x-2 text-sm">
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
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-neutral-200 p-0.5 dark:bg-neutral-800"
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
        className="flex !size-7 items-center justify-center p-0"
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
        className="border-border flex !h-7 w-auto items-center gap-2 rounded-md border px-2"
      >
        <div className="h-1 w-1 shrink-0 rounded-full bg-orange-500"></div>
        <div className="max-w-16 min-w-0 truncate">
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
        className="border-border flex !h-7 w-auto items-center gap-2 rounded-md border px-2"
      >
        <div className="h-1 w-1 shrink-0 rounded-full bg-blue-500"></div>
        <div className="max-w-16 min-w-0 truncate">
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
        className="border-border flex !h-7 w-auto items-center gap-2 rounded-md border px-2"
      >
        <div className="h-1 w-1 shrink-0 rounded-full bg-blue-500"></div>
        <div className="max-w-16 min-w-0 truncate">
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
            <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800">
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
