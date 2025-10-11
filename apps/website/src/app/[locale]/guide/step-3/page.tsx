'use client'

import { Button } from '@repo/ui/components/button'
import { IconArrowRight } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { useGetTargetLanguage } from '@/hooks/useGetTargetLanguage'
import { useHasTranslation } from '@/hooks/useHasTranslation'
import { QUOTES } from '@/utils/constants/quotes'

export default function GuidePage() {
  const t = useTranslations()
  const hasTranslated = useHasTranslation()
  const targetLanguage = useGetTargetLanguage()
  const quote = QUOTES[targetLanguage === 'eng' ? 'jpn' : 'eng']

  return (
    <div className="bg-background grid md:grid-cols-2 grid-rows-2 md:grid-rows-1 h-fit md:h-[100vh]">
      <div className="notranslate md:border-r border-b md:border-b-0 p-8 lg:p-16 xl:p-30 flex flex-col gap-4 justify-center">
        <h1 className="text-2xl font-bold">{t('guide.step3.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('guide.step3.description')}
        </p>
        <Image
          src="/images/guide/step-3.png"
          alt="step-3"
          width={400}
          height={400}
        />
        <div className="mt-6">
          {hasTranslated === true
            ? (
                <Button asChild className="notranslate">
                  <Link href="/guide/step-4">
                    {t('guide.continue')}
                    {' '}
                    <IconArrowRight className="size-4" />
                  </Link>
                </Button>
              )
            : (
                <Button disabled>
                  {t('guide.continue')}
                  {' '}
                  <IconArrowRight className="size-4" />
                </Button>
              )}
          <div className="text-xs text-muted-foreground mt-2">
            {hasTranslated === true
              ? t('guide.step3.hint.translated')
              : t('guide.step3.hint.notTranslated')}
          </div>
        </div>
        <Link
          className="text-muted-foreground text-sm mt-6"
          href="/guide/step-4"
        >
          {t('guide.skip')}
        </Link>
      </div>
      <div className="h-fit md:h-full p-8 flex justify-center items-center">
        {targetLanguage && (
          <div className="flex flex-col gap-4 text-neutral-700 dark:text-neutral-300">
            <h2 className="text-2xl font-bold mb-4">{quote.title}</h2>
            {quote.sentences.map(quote => (
              <div key={quote}>{quote}</div>
            ))}
            <span className="text-sm text-muted-foreground">
              {quote.author}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
