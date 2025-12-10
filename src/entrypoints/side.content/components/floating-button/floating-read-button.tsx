import { i18n } from '#imports'
import { useAtomValue, useSetAtom } from 'jotai'

import { toast } from 'sonner'
import { useExtractContent } from '@/hooks/read/extract'
import { useReadArticle } from '@/hooks/read/read'
import { configFieldsAtomMap } from '@/utils/atoms/config'

import { isAnyAPIKeyForReadProviders } from '@/utils/config/api'
import { isSideOpenAtom } from '../../atoms'
import HiddenButton from './components/hidden-button'

export default function FloatingReadButton({ className }: { className: string }) {
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setIsSideOpen = useSetAtom(isSideOpenAtom)
  const {
    mutate: readArticle,
    analyzeContent,
    explainArticle,
  } = useReadArticle()
  const { isPending: isExtractingContent, data: extractedContent } = useExtractContent()

  const startReadArticle = () => {
    if (!isAnyAPIKeyForReadProviders(providersConfig)) {
      toast.error(i18n.t('noAPIKeyConfig.warning'))
      return
    }

    setIsSideOpen(true)
    if (isExtractingContent) {
      toast.warning('Waiting content to be extracted...')
      return
    }
    if (!isExtractingContent && !extractedContent) {
      toast.error('Failed to extract content')
      return
    }
    if (analyzeContent.isPending || explainArticle.isPending) {
      toast.warning('Reading in progress...')
      return
    }
    void readArticle()
  }

  return <HiddenButton icon="tabler:book" onClick={startReadArticle} className={className} />
}
