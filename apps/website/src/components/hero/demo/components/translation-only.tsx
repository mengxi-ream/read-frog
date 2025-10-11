'use client'

import type { AnimationSequence } from 'motion/react'
import { QUOTES } from '@/utils/constants/quotes'
import { TranslationCard } from './translation-card'

const originalQuote = QUOTES.eng

function runSequence() {
  const sequence: AnimationSequence = [
    ['.spinner-title', { display: 'none', opacity: 0 }],
    [`.title`, { display: 'none' }],
    ['.translation-title', { display: 'block' }],
  ]

  for (let i = 0; i < originalQuote.sentences.length; i++) {
    sequence.push(
      [`.spinner-sentence-${i}`, { display: 'none' }],
      [`.sentence-${i}`, { display: 'none', opacity: 0 }],
      [`.translation-sentence-${i}`, { display: 'block' }],
    )
  }

  sequence.push(
    ['.spinner-author', { display: 'none' }],
    [`.author`, { display: 'none', opacity: 0 }],
    ['.translation-author', { display: 'block' }],
  )

  return sequence
}

export function TranslationOnly() {
  const sequence = runSequence()

  return <TranslationCard initial={{ x: 50 }} whileInView={{ x: 10 }} sequence={sequence} className="origin-top-left" />
}
