'use client'

import { Install } from '@/components/install'
import HeroHighlight from './components/hero-highlight'

export function Recall() {
  return (
    <section className="w-full">
      <HeroHighlight>
        <div
          className="max-w-6xl py-32 px-8 flex items-center justify-center flex-col gap-12"
        >
          <h1 className="text-4xl font-bold">
            获取您的 AI 学习助手
          </h1>
          <span className="text-center text-lg text-zinc-700 dark:text-zinc-300 text-wrap">
            Read Frog 致力于为各个级别的语言学习者提供易于使用、智能化和个性化的语言学习体验，让世界不再依赖人类语言教师。
          </span>
          <Install />
        </div>
      </HeroHighlight>
    </section>
  )
}
