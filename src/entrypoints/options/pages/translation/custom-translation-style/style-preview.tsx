import { i18n } from '#imports'
import { LANG_CODE_ISO6391_OPTIONS } from '@read-frog/definitions'
import { useAtomValue } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { Field, FieldLabel } from '@/components/shadcn/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { Textarea } from '@/components/shadcn/textarea'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { BLOCK_CONTENT_CLASS, CONTENT_WRAPPER_CLASS } from '@/utils/constants/dom-labels'
import { decorateTranslationNode } from '@/utils/host/translate/ui/decorate-translation'

export function StylePreview() {
  const { translationNodeStyle } = useAtomValue(configFieldsAtomMap.translate)

  const blockContentRef = useRef<HTMLSpanElement>(null)
  const [language, setLanguage] = useState<string>('zh')
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr')
  const [translatedText, setTranslatedText] = useState('神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。')

  useEffect(() => {
    if (blockContentRef.current) {
      void decorateTranslationNode(blockContentRef.current, translationNodeStyle)
    }
  }, [translationNodeStyle])

  return (
    <>
      {translationNodeStyle.isCustom && (
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="language-select">
              {i18n.t('options.translation.translationStyle.stylePreviewLanguage')}
            </FieldLabel>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANG_CODE_ISO6391_OPTIONS.map(lang => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="dir-select">
              {i18n.t('options.translation.translationStyle.stylePreviewDirection')}
            </FieldLabel>
            <Select value={dir} onValueChange={value => setDir(value as 'ltr' | 'rtl')}>
              <SelectTrigger id="dir-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ltr">ltr (Left to Right)</SelectItem>
                <SelectItem value="rtl">rtl (Right to Left)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      {translationNodeStyle.isCustom && (
        <Field>
          <FieldLabel htmlFor="preview-text">
            {i18n.t('options.translation.translationStyle.stylePreviewTranslatedText')}
          </FieldLabel>
          <Textarea
            id="preview-text"
            value={translatedText}
            onChange={e => setTranslatedText(e.target.value)}
            className="min-h-20"
          />
        </Field>
      )}

      <Field>
        <FieldLabel>
          {i18n.t('options.translation.translationStyle.preview')}
        </FieldLabel>
        <div id="style-preview" className="w-full flex flex-col gap-2 p-4 border rounded-md">
          <span className={CONTENT_WRAPPER_CLASS} lang={language} dir={dir}>
            <span className={`text-sm ${BLOCK_CONTENT_CLASS}`} ref={blockContentRef}>
              {translatedText}
            </span>
          </span>
        </div>
      </Field>
    </>
  )
}
