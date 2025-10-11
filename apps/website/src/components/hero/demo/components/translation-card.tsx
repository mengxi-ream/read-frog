'use client'

import type { AnimationSequence, TargetAndTransition } from 'motion/react'
import { cn } from '@repo/ui/lib/utils'
import { motion, useAnimate, useInView } from 'motion/react'
import { useEffect } from 'react'
import { MacBrowserShell } from '@/components/mac-browser-shell'
import { Spinner } from '@/components/spinner'
import { QUOTES } from '@/utils/constants/quotes'

const originalQuote = QUOTES.eng
const translatedQuote = QUOTES.cn

export const TIMING = {
  START: 1,
  PAUSE: 4,
  DURATION: 4,
}

export function TranslationCard(
  { initial, whileInView, className, sequence }:
  { initial: TargetAndTransition, whileInView: TargetAndTransition, className?: string, sequence: AnimationSequence },
) {
  const [scope, animate] = useAnimate()
  const inView = useInView(scope, { amount: 0.6, once: true })

  useEffect(() => {
    if (!inView)
      return

    const animation = animate(sequence, { duration: TIMING.DURATION, repeat: Infinity, repeatDelay: TIMING.PAUSE, delay: TIMING.START })

    return () => {
      animation.stop()
    }
    // eslint-disable-next-line  react-hooks/exhaustive-deps
  }, [inView])

  return (
    <div className={cn('scale-50 md:scale-100 h-240 md:h-180 w-screen', className)}>
      <motion.div
        className={cn('h-full w-screen flex flex-col gap-4 justify-start items-center border-zinc-200 overflow-hidden')}
        initial={initial}
        whileInView={whileInView}
        transition={{ duration: 0.5 }}
        viewport={{ amount: 0.3 }}
      >
        <MacBrowserShell className="h-full w-full">
          <div ref={scope} className="flex flex-col gap-4 text-neutral-700 dark:text-neutral-300 p-8 max-w-full overflow-hidden">
            <div className="mb-4 max-w-full">
              <div className="flex flex-col gap-2">
                <div>
                  <span className="text-2xl font-bold title">{originalQuote.title}</span>
                  <div className="spinner-title">
                    <Spinner />
                  </div>
                </div>
                <h2 className="translation-title text-2xl font-bold hidden">
                  {translatedQuote.title}
                </h2>
              </div>
            </div>

            {originalQuote.sentences.map((sentence, index) => (
              <div key={sentence} className="flex flex-col gap-2 max-w-full">
                <div className="flex justify-right items-center gap-2">
                  <div className={`sentence-${index}`}>{sentence}</div>
                  <div className={`spinner-sentence-${index}`}>
                    <Spinner />
                  </div>
                </div>
                <span className={`translation-sentence-${index} hidden`}>
                  {translatedQuote.sentences[index]}
                </span>
              </div>
            ))}

            <div className="flex flex-col gap-2 max-w-full">
              <div>
                <span className="text-sm text-muted-foreground author">{originalQuote.author}</span>
                <div className="spinner-author">
                  <Spinner />
                </div>
              </div>
              <span className="translation-author text-sm text-muted-foreground hidden">
                {translatedQuote.author}
              </span>
            </div>
          </div>
        </MacBrowserShell>
      </motion.div>
    </div>
  )
}
