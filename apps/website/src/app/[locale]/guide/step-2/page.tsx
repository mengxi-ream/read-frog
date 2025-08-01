'use client'

import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/shadcn/button'
import { useExtensionPinned } from '@/hooks/useExtensionPinned'

export default function GuidePage() {
  const t = useTranslations()
  const isPinned = useExtensionPinned()
  return (
    <div className="bg-background grid md:grid-cols-2 grid-rows-2 md:grid-rows-1 h-fit md:h-[100vh]">
      <div className="md:border-r border-b md:border-b-0 p-8 lg:p-16 xl:p-30 flex flex-col gap-4 justify-center">
        <h1 className="text-2xl font-bold">{t('guide.step2.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('guide.step2.description')}
        </p>
        <div className="mt-6">
          {isPinned === true
            ? (
                <Button asChild variant="primary" disabled>
                  <Link href="/guide/step-3">
                    {t('guide.continue')}
                    {' '}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              )
            : (
                <Button variant="primary" disabled>
                  {t('guide.continue')}
                  {' '}
                  <ArrowRight size={16} />
                </Button>
              )}
          <div className="text-xs text-muted-foreground mt-2">
            {isPinned === true
              ? t('guide.step2.hint.pinned')
              : t('guide.step2.hint.unpinned')}
          </div>
        </div>
        <Link
          className="text-muted-foreground text-sm mt-6"
          href="/guide/step-3"
        >
          {t('guide.skip')}
        </Link>
      </div>
      <div className="p-8 flex justify-center items-center">
        <div>
          <Image
            src="/images/guide/step-2.png"
            alt="Guide Step 2"
            width={600}
            height={600}
          />
        </div>
      </div>
    </div>
  )
}
