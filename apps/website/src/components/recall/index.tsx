'use client'

import { motion } from 'motion/react'
import { Install } from '@/components/install'
import HeroHighlight from './components/hero-highlight'

export function Recall() {
  const variants = {
    hidden: { opacity: 0.0, y: 40 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <section className="w-full">
      <HeroHighlight>
        <motion.div
          className="max-w-6xl py-32 px-8 flex items-center justify-center flex-col gap-12"
        >
          <motion.div variants={variants} initial="hidden" whileInView="show" transition={{ delay: 0, duration: 0.3, ease: 'easeInOut' }}>
            <h1 className="text-4xl font-bold">
              获取您的 AI 学习助手
            </h1>
          </motion.div>
          <motion.div variants={variants} initial="hidden" whileInView="show" transition={{ delay: 0.3, duration: 0.3, ease: 'easeInOut' }}>
            <span className="text-center text-lg text-zinc-700 dark:text-zinc-300 text-wrap">
              Read Frog 致力于为各个级别的语言学习者提供易于使用、智能化和个性化的语言学习体验，让世界不再依赖人类语言教师。
            </span>
          </motion.div>
          <motion.div variants={variants} initial="hidden" whileInView="show" transition={{ delay: 0.6, duration: 0.3, ease: 'easeInOut' }}>
            <Install />
          </motion.div>
        </motion.div>
      </HeroHighlight>
    </section>
  )
}
