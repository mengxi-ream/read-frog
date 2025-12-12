import { useSetAtom } from 'jotai'

import { isSideOpenAtom } from '../../atoms'
import HiddenButton from './components/hidden-button'

export default function FloatingReadButton({ className }: { className: string }) {
  const setIsSideOpen = useSetAtom(isSideOpenAtom)

  const openPanel = () => {
    setIsSideOpen(true)
  }

  return <HiddenButton icon="tabler:book" onClick={openPanel} className={className} />
}
