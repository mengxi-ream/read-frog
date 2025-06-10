'use client'

import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/shadcn/button'

export default function GuidePage() {
  const t = useTranslations()
  return (
    <div className="bg-background grid grid-cols-2 h-[100vh]">
      <div className="border-r p-8 lg:p-16 xl:p-30 flex flex-col gap-4 justify-center">
        <h1 className="text-2xl font-bold">{t('guide.step4.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('guide.step4.description')}
        </p>
        <div className="mt-6">
          <div className="flex gap-2">
            <Button asChild disabled>
              <Link href="/">
                {t('guide.finish')}
                {' '}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-primary">
              <Link href="/tutorial/api-key">
                {t('guide.step4.tutorial')}
                {' '}
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="text-xs text-muted-foreground mt-2">
            {t('guide.step4.hint')}
          </div>
        </div>
      </div>
      <div className="p-8 flex justify-center items-center">
        <div>
          <Image
            src="/images/guide/step-4.png"
            alt="Guide Step 4"
            width={600}
            height={600}
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  )
}
