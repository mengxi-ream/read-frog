import { Toaster } from 'sonner'
import { NOTRANSLATE_CLASS } from '@/utils/constants/dom-labels'
import { cn } from '@/utils/styles/tailwind'
import { useInputTranslation } from './input-translation'
import { SelectionToolbar } from './selection-toolbar'

export default function App() {
  useInputTranslation()

  return (
    <div className={cn('text-black dark:text-white', NOTRANSLATE_CLASS)}>
      <SelectionToolbar />
      <Toaster richColors className="z-2147483647 notranslate" />
    </div>
  )
}
