import type {
  LangCodeISO6393,
  LangLevel,
} from '@repo/definitions'
import type { DOWNLOAD_FILE_TYPES } from '../../utils/downloader'
import type { ArticleExplanation } from '@/types/content'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  LANG_CODE_TO_EN_NAME,
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
  langLevel,
} from '@repo/definitions'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@repo/ui/components/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/tooltip'
import { cn } from '@repo/ui/lib/utils'
import { useMutationState } from '@tanstack/react-query'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import ReadProviderSelector from '@/components/llm-providers/read-provider-selector'
import { useTheme } from '@/components/providers/theme-provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { readProviderConfigAtom } from '@/utils/atoms/provider'
import { getFinalSourceCode } from '@/utils/config/languages'
import { READ_PROVIDER_ITEMS } from '@/utils/constants/providers'
import { DOWNLOAD_FILE_ITEMS } from '@/utils/constants/side'
import { shadowWrapper } from '../..'
import { isSideOpenAtom } from '../../atoms'
import downloader from '../../utils/downloader'

export function TopBar({ className }: { className?: string }) {
  const { theme } = useTheme()
  const setIsSideOpen = useSetAtom(isSideOpenAtom)
  const readProviderConfig = useAtomValue(readProviderConfigAtom)
  const readConfig = useAtomValue(configFieldsAtomMap.read)

  return (
    <div className={cn('flex items-start justify-between', className)}>
      <div className="flex items-center gap-x-2 text-sm">
        <SourceLangSelect />
        <Icon icon="tabler:arrow-right" className="-mx-1" />
        <TargetLangSelect />
        <LangLevelSelect />
        <ReadProviderSelector
          className="flex !size-7 items-center justify-center p-0"
          hideChevron
          customTrigger={(
            <img
              src={READ_PROVIDER_ITEMS[readProviderConfig.provider].logo(theme)}
              alt={readConfig.providerId}
              className="size-4 p-0.5 rounded-full"
            />
          )}
          container={shadowWrapper}
        />
        <FileExport />
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-neutral-200 p-0.5 dark:bg-neutral-800"
            onClick={() => setIsSideOpen(false)}
          >
            <Icon icon="tabler:x" className="text-neutral-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent container={shadowWrapper} side="left">
          <p>Close</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function LangLevelSelect() {
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)

  return (
    <Select
      value={language.level}
      onValueChange={(newLevel: LangLevel) => setLanguage({ level: newLevel })}
    >
      <SelectTrigger
        hideChevron
        className="border-border flex !h-7 w-auto items-center gap-2 rounded-md border px-2"
      >
        <div className="max-w-15 min-w-0 truncate">
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
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)

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
        <div className="max-w-15 min-w-0 truncate">
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
  const [language, setLanguage] = useAtom(configFieldsAtomMap.language)

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
        <div className="max-w-15 min-w-0 truncate">
          {LANG_CODE_TO_EN_NAME[getFinalSourceCode(language.sourceCode, language.detectedCode)]}
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
  if (!allow) {
    return null
  }
  return (
    <Select
      value=""
      onValueChange={async (fileType: DOWNLOAD_FILE_TYPES) => {
        downloader.download(explainDataList, fileType)
      }}
    >
      <SelectTrigger
        hideChevron
        className="rounded-md flex !size-7 items-center justify-center p-0 shadow-xs border focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 border-input"
      >
        <Icon
          icon="tabler:download"
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
