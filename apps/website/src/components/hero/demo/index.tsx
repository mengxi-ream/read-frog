import { Bilingual } from './components/bilingual'
import { TranslationOnly } from './components/translation-only'

export function Demo() {
  return (
    <section className="flex justify-center h-fit md:h-180 bg-zinc-50 dark:bg-zinc-900">
      <div className="max-w-full h-full w-full flex flex-col gap-4 md:grid md:grid-cols-2 md:grid-rows-1 pb-16">
        <Bilingual />
        <TranslationOnly />
      </div>
    </section>
  )
}
