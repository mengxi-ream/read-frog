import type { TranslationNodeStyle } from '@/types/config/translate'
import { i18n } from '#imports'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import { deepmerge } from 'deepmerge-ts'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { configFields } from '@/utils/atoms/config'
import { BLOCK_CONTENT_CLASS } from '@/utils/constants/dom-labels'
import { TRANSLATION_NODE_STYLE } from '@/utils/constants/translation-node-style'
import { decorateTranslationNode } from '@/utils/host/translate/decorate-translation'
import { ConfigCard } from '../../components/config-card'

export function CustomTranslationStyle() {
  return (
    <ConfigCard title={i18n.t('options.translation.translationStyle.title')} description={i18n.t('options.translation.translationStyle.description')}>
      <CustomTranslationStyleSelector />
      <CustomTranslationStyleExample />
    </ConfigCard>
  )
}

function CustomTranslationStyleSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  const originTranslationNodeStyle = translateConfig.translationNodeStyle

  return (
    <div className="w-full flex justify-start md:justify-end">
      <Select
        value={originTranslationNodeStyle}
        onValueChange={(translationNodeStyle: TranslationNodeStyle) =>
          setTranslateConfig(
            deepmerge(translateConfig, { translationNodeStyle }),
          )}
      >
        <SelectTrigger className="w-40">
          <SelectValue asChild>
            <span>
              {i18n.t(
                `options.translation.translationStyle.style.${originTranslationNodeStyle}`,
              )}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TRANSLATION_NODE_STYLE.map(nodeStyle => (
              <SelectItem key={nodeStyle} value={nodeStyle}>
                {i18n.t(
                  `options.translation.translationStyle.style.${nodeStyle}`,
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function CustomTranslationStyleExample() {
  const { translationNodeStyle } = useAtomValue(configFields.translate)

  const translatedNode = useRef(null)
  const originText = `Mr. Kamiya isn\'t confronting the world; he\'s confronting something that might make the world turn its head.`
  const translatedText = '神谷先生不是在对抗世界，而是在对抗可能让世界为之侧目的事物。'

  useEffect(() => {
    if (translatedNode.current) {
      decorateTranslationNode(translatedNode.current, translationNodeStyle)
    }
  }, [translationNodeStyle])

  return (
    <div className="w-full flex flex-col gap-2 mt-4">
      <p className="text-sm">
        { originText }
      </p>
      <p className={`text-sm ${BLOCK_CONTENT_CLASS}`} ref={translatedNode}>
        { translatedText }
      </p>
    </div>
  )
}
