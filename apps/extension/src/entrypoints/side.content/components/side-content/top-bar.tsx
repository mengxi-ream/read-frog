import type { DOWNLOAD_FILE_TYPES } from '../../utils/downloader'
import type {
  LangCodeISO6393,
  LangLevel,
} from '@/types/config/languages'
import type { ReadProviderNames } from '@/types/config/provider'
import type { ArticleExplanation } from '@/types/content'
import { SelectGroup } from '@radix-ui/react-select'
import { useMutationState } from '@tanstack/react-query'
// import { onMessage } from "@/utils/message";
import { useAtom, useSetAtom } from 'jotai'
import { ArrowRight, Download, X } from 'lucide-react'
import ProviderIcon from '@/components/provider-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
  langLevel,
} from '@/types/config/languages'
import { configFields } from '@/utils/atoms/config'
import { READ_PROVIDER_ITEMS } from '@/utils/constants/config'
import { DOWNLOAD_FILE_ITEMS } from '@/utils/constants/side'
import { cn } from '@/utils/tailwind'
import { shadowWrapper } from '../..'
import { isSideOpenAtom } from '../../atoms'
import downloader from '../../utils/downloader'

export function TopBar({ className }: { className?: string }) {
  const setIsSideOpen = useSetAtom(isSideOpenAtom)

  return (
    <div className={cn('flex items-start justify-between', className)}>
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
        <FileExport />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
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
  )
}

function ProviderSelect() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)

  return (
    <Select
      value={readConfig.provider}
      onValueChange={(value: ReadProviderNames) => {
        setReadConfig({
          ...readConfig,
          provider: value,
        })
      }}
    >
      <SelectTrigger
        hideChevron
        className="flex !size-7 items-center justify-center p-0"
      >
        <img
          src={READ_PROVIDER_ITEMS[readConfig.provider].logo}
          alt={readConfig.provider}
          className="size-4 p-0.5 bg-white rounded-full"
        />
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t('readService.title')}</SelectLabel>
          {Object.entries(READ_PROVIDER_ITEMS).map(([provider, { logo, name }]) => (
            <SelectItem key={provider} value={provider}>
              <ProviderIcon logo={logo} name={name} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function LangLevelSelect() {
  const [language, setLanguage] = useAtom(configFields.language)

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
          <SelectLabel>{i18n.t('languageLevel')}</SelectLabel>
          {langLevel.options.map(level => (
            <SelectItem key={level} value={level}>
              {i18n.t(`languageLevels.${level}`)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function TargetLangSelect() {
  const [language, setLanguage] = useAtom(configFields.language)

  return (
    <Select
      value={language.targetCode}
      onValueChange={(newTargetCode: LangCodeISO6393) =>
        setLanguage({ targetCode: newTargetCode })}
    >
      <SelectTrigger
        hideChevron
        className="border-border flex !h-7 w-auto items-center gap-2 rounded-md border px-2"
      >
        <div className="h-1 w-1 shrink-0 rounded-full bg-blue-500"></div>
        <div className="max-w-16 min-w-0 truncate">
          {`${LANG_CODE_TO_EN_NAME[language.targetCode]} (${LANG_CODE_TO_LOCALE_NAME[language.targetCode]})`}
        </div>
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t('side.targetLang')}</SelectLabel>
          {langCodeISO6393Schema.options.map(key => (
            <SelectItem key={key} value={key}>
              {`${LANG_CODE_TO_EN_NAME[key]} (${LANG_CODE_TO_LOCALE_NAME[key]})`}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function SourceLangSelect() {
  const [language, setLanguage] = useAtom(configFields.language)

  return (
    <Select
      value={language.sourceCode}
      onValueChange={(newSourceCode: LangCodeISO6393 | 'auto') =>
        setLanguage({ sourceCode: newSourceCode })}
    >
      <SelectTrigger
        hideChevron
        className="border-border flex !h-7 w-auto items-center gap-2 rounded-md border px-2"
      >
        <div className="h-1 w-1 shrink-0 rounded-full bg-blue-500"></div>
        <div className="max-w-16 min-w-0 truncate">
          {language.sourceCode === 'auto'
            ? LANG_CODE_TO_EN_NAME[language.detectedCode]
            : LANG_CODE_TO_EN_NAME[language.sourceCode]}
        </div>
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t('side.sourceLang')}</SelectLabel>
          <SelectItem value="auto">
            {`${LANG_CODE_TO_EN_NAME[language.detectedCode]} (${LANG_CODE_TO_LOCALE_NAME[language.detectedCode]})`}
            <span className="rounded-full bg-neutral-200 px-1 text-xs dark:bg-neutral-800">
              auto
            </span>
          </SelectItem>
          {langCodeISO6393Schema.options.map(key => (
            <SelectItem key={key} value={key}>
              {`${LANG_CODE_TO_EN_NAME[key]} (${LANG_CODE_TO_LOCALE_NAME[key]})`}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function FileExport() {
  const explainDataList = useMutationState<ArticleExplanation['paragraphs']>({
    filters: {
      mutationKey: ['explainArticle'],
    },
    select: mutation => mutation.state.data as ArticleExplanation['paragraphs'],
  })

  const allow = !!explainDataList.length && explainDataList.every(explainData => !!explainData)
  return (
    <Select
      value=""
      onValueChange={async (fileType: DOWNLOAD_FILE_TYPES) => {
        downloader.download(explainDataList, fileType)
      }}
      disabled={!allow}
    >
      <SelectTrigger
        hideChevron
        className="rounded-md flex !size-7 items-center justify-center p-0 shadow-xs border focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 border-input"
      >
        <Download
          className="size-4 p-0.5 bg-white rounded-full"
        />
      </SelectTrigger>
      <SelectContent container={shadowWrapper}>
        <SelectGroup>
          <SelectLabel>{i18n.t('side.fileExport')}</SelectLabel>
          {Object.entries(DOWNLOAD_FILE_ITEMS).map(([fileType, { label }]) => (
            <SelectItem key={fileType} value={fileType}>
              { label }
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
