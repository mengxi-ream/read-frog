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
  DURATION: 6,
}

export function TranslationCard(
  { initial, className, sequence }:
  { initial: TargetAndTransition, className?: string, sequence: AnimationSequence },
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
    <div className="w-full overflow-hidden">
      <motion.div
        className={cn('h-fit md:h-full w-full px-6 md:px-8 flex flex-col gap-4 justify-start md:items-center border-zinc-200', className)}
        initial={initial}
        whileInView={{ x: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ amount: 0.3, once: true }}
      >
        <MacBrowserShell className="h-full w-full max-w-full">
          <div ref={scope} className="flex flex-col gap-4 text-neutral-700 dark:text-neutral-300 p-8 min-w-0 max-w-full overflow-hidden">
            <div className="mb-4 min-w-0 max-w-full">
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl font-bold title break-words min-w-0 flex-1">{originalQuote.title}</span>
                  <div className="spinner-title flex-shrink-0">
                    <Spinner />
                  </div>
                </div>
                <h2 className="translation-title text-2xl font-bold hidden break-words min-w-0">
                  {translatedQuote.title}
                </h2>
              </div>
            </div>

            {originalQuote.sentences.map((sentence, index) => (
              <div key={sentence} className="flex flex-col gap-2 min-w-0 max-w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`sentence-${index} break-words min-w-0 flex-1`}>{sentence}</span>
                  <div className={`spinner-sentence-${index} flex-shrink-0`}>
                    <Spinner />
                  </div>
                </div>
                <div className={`translation-sentence-${index} hidden break-words min-w-0`}>
                  {translatedQuote.sentences[index]}
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-2 min-w-0 max-w-full">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-sm text-muted-foreground author break-words min-w-0 flex-1">{originalQuote.author}</div>
                <div className="spinner-author flex-shrink-0">
                  <Spinner />
                </div>
              </div>
              <div className="translation-author text-sm text-muted-foreground hidden break-words min-w-0">
                {translatedQuote.author}
              </div>
            </div>
          </div>
        </MacBrowserShell>
      </motion.div>
    </div>
  )
}
