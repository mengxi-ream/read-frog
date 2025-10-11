import { Bilingual } from './components/bilingual'
import { TranslationOnly } from './components/translation-only'

export function Demo() {
  return (
    <section className="flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 overflow-hidden pb-8">
      <div className="flex justify-center h-120 md:h-180 min-w-[200vw] max-w-[200vw] md:w-screen">
        <Bilingual />
        <TranslationOnly />
      </div>
    </section>
  )
}
