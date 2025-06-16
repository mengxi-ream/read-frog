'use client'

import type {
  LangCodeISO6393,
} from '@/types/languages'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { useInitTargetLanguage } from '@/hooks/useInitTargetLanguage'
import {
  LANG_CODE_TO_LOCALE_NAME,
  langCodeISO6393Schema,
} from '@/types/languages'

export default function Step1Page() {
  const t = useTranslations()
  const [targetLanguage, updateTargetLanguage] = useInitTargetLanguage()
  return (
    <div className="bg-background grid md:grid-cols-2 grid-rows-2 md:grid-rows-1 h-[100vh] ">
      <div className="md:border-r border-b md:border-b-0  p-8 lg:p-16 xl:p-30 flex flex-col gap-4 justify-center">
        <h1 className="text-2xl font-bold">{t('guide.step1.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('guide.step1.description')}
        </p>
        <div className="text-xs -mb-2 mt-6">
          {t('guide.step1.nativeLanguage')}
        </div>
        <Select
          disabled={!targetLanguage}
          value={targetLanguage}
          onValueChange={(value: LangCodeISO6393) =>
            updateTargetLanguage(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a language" />
          </SelectTrigger>
          <SelectContent>
            {langCodeISO6393Schema.options.map(langCode => (
              <SelectItem key={langCode} value={langCode}>
                {`${t(`language.${langCode}`)} (${
                  LANG_CODE_TO_LOCALE_NAME[langCode]
                })`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-6">
          <Button asChild>
            <Link href="/guide/step-2">
              {t('guide.continue')}
              {' '}
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <Link
          className="text-muted-foreground text-sm mt-6"
          href="/guide/step-2"
        >
          {t('guide.skip')}
        </Link>
      </div>
      <div className="p-8 flex justify-center items-center">
        <div className="max-w-[300px]">
          <Image
            src="/images/guide/step-1.png"
            alt="Guide Step 1"
            width={500}
            height={500}
          />
        </div>
      </div>
    </div>
  )
}
