import FrogToast from '@/components/frog-toast'
import { NOTRANSLATE_CLASS } from '@/utils/constants/dom-labels'
import { cn } from '@/utils/styles/utils'
import FloatingButton from './components/floating-button'
import SideContent from './components/side-content'

export default function App() {
  return (
    <div className={cn('text-black dark:text-white', NOTRANSLATE_CLASS)}>
      <FloatingButton />
      <SideContent />
      <FrogToast />
    </div>
  )
}
