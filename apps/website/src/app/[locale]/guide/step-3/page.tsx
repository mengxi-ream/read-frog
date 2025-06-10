'use client'

import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/shadcn/button'
import { useGetTargetLanguage } from '@/hooks/useGetTargetLanguage'
import { useHasTranslation } from '@/hooks/useHasTranslation'

const QUOTES: Record<
  'eng' | 'jpn',
  {
    title: string
    author: string
    sentences: string[]
  }
> = {
  eng: {
    title: 'Spark: 5 Quotes',
    author: '— Naoki Matayoshi',
    sentences: [
      '1. As long as you\'re alive, there\'s no bad ending.',
      '2. Write down what you saw today in your own words while you\'re still alive.',
      '3. Mr. Kamiya isn\'t confronting the world; he\'s confronting something that might make the world turn its head.',
      '4. I believe comedians never truly retire.',
      '5. Even the days you spent aimlessly will one day become treasures.',
    ],
  },
  jpn: {
    title: '『火花』名言五選',
    author: '―― 又吉直樹',
    sentences: [
      '1. 生きている限り、バッドエンドはない。',
      '2. お前の言葉で今日見たものを生きてるうちに書けよ。',
      '3. 神谷さんが相手にしているのは世間やないねん。世間を振り向かせるかもしれん何かやねん。',
      '4. オレな、芸人には引退なんてないと思うねん。',
      '5. なんとなく過ごした日々も、後から宝物になるんですよ。',
    ],
  },
}

export default function GuidePage() {
  const t = useTranslations()
  const hasTranslated = useHasTranslation()
  const targetLanguage = useGetTargetLanguage()
  const quote = QUOTES[targetLanguage === 'eng' ? 'jpn' : 'eng']

  return (
    <div className="bg-background grid grid-cols-2 h-[100vh]">
      <div className="notranslate border-r p-8 lg:p-16 xl:p-30 flex flex-col gap-4 justify-center">
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
                    <ArrowRight />
                  </Link>
                </Button>
              )
            : (
                <Button disabled>
                  {t('guide.continue')}
                  {' '}
                  <ArrowRight />
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
      <div className="p-8 flex justify-center items-center">
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
