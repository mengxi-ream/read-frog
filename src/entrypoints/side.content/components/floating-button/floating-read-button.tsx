import { useAtomValue, useSetAtom } from 'jotai'
import { BookOpenText } from 'lucide-react'
import { toast } from 'sonner'

import { useExtractContent } from '@/hooks/read/extract'
import { useReadArticle } from '@/hooks/read/read'
import { configFields } from '@/utils/atoms/config'
import { isAnyAPIKey } from '@/utils/config/config'

import { isSideOpenAtom } from '../../atoms'
import HiddenButton from './components/hidden-button'

export default function FloatingReadButton() {
  const providersConfig = useAtomValue(configFields.providersConfig)
  const setIsSideOpen = useSetAtom(isSideOpenAtom)
  const {
    mutate: readArticle,
    analyzeContent,
    explainArticle,
  } = useReadArticle()
  const { data: extractedContent } = useExtractContent()

  const startReadArticle = () => {
    if (!isAnyAPIKey(providersConfig)) {
      toast.error(i18n.t('noConfig.warning'))
      return
    }

    setIsSideOpen(true)
    if (!extractedContent) {
      toast.warning('Waiting content to be extracted...')
      return
    }
    if (analyzeContent.isPending || explainArticle.isPending) {
      toast.warning('Reading in progress...')
      return
    }
    readArticle()
  }

  return <HiddenButton Icon={BookOpenText} onClick={startReadArticle} />
}
