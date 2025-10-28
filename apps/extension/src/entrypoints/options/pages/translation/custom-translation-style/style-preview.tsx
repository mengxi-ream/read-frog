import { i18n } from '#imports'
import { Field, FieldContent, FieldLabel } from '@repo/ui/components/field'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { BLOCK_CONTENT_CLASS } from '@/utils/constants/dom-labels'
import { decorateTranslationNode } from '@/utils/host/translate/decorate-translation'

export function StylePreview() {
  const { translationNodeStyle } = useAtomValue(configFieldsAtomMap.translate)

  const translatedNode = useRef(null)
  const originText = `Mr. Kamiya isn't confronting the world; he's confronting something that might make the world turn its head.`
  const translatedText = '神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。'

  useEffect(() => {
    if (translatedNode.current) {
      void decorateTranslationNode(translatedNode.current, translationNodeStyle)
    }
  }, [translationNodeStyle])

  return (
    <Field>
      <FieldContent>
        <FieldLabel htmlFor="style-preview">
          {i18n.t('options.translation.translationStyle.preview')}
        </FieldLabel>
      </FieldContent>
      <div id="style-preview" className="w-full flex flex-col gap-2 p-4 border rounded-md">
        <p className="text-sm">
          { originText }
        </p>
        <p className={`text-sm ${BLOCK_CONTENT_CLASS}`} ref={translatedNode}>
          { translatedText }
        </p>
      </div>
    </Field>
  )
}
