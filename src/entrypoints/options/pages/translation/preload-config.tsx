import type { PreloadConfig as PreloadConfigType } from '@/types/config/translate'
import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Input } from '@/components/shadcn/input'
import { preloadConfigSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MAX_PRELOAD_MARGIN, MAX_PRELOAD_THRESHOLD, MIN_PRELOAD_MARGIN, MIN_PRELOAD_THRESHOLD } from '@/utils/constants/translate'
import { ConfigCard } from '../../components/config-card'

type KeyOfPreloadConfig = keyof PreloadConfigType

export function PreloadConfig() {
  return (
    <ConfigCard
      title={i18n.t('options.translation.preloadConfig.title')}
      description={i18n.t('options.translation.preloadConfig.description')}
    >
      <FieldGroup>
        <PreloadNumberSelector property="margin" />
        <PreloadNumberSelector property="threshold" />
      </FieldGroup>
    </ConfigCard>
  )
}

const propertyInfo = {
  margin: {
    label: () => i18n.t('options.translation.preloadConfig.margin.title'),
    description: () => i18n.t('options.translation.preloadConfig.margin.description'),
  },
  threshold: {
    label: () => i18n.t('options.translation.preloadConfig.threshold.title'),
    description: () => i18n.t('options.translation.preloadConfig.threshold.description'),
  },
}

const propertyConstraints = {
  margin: { min: MIN_PRELOAD_MARGIN, max: MAX_PRELOAD_MARGIN, step: 100 },
  threshold: { min: MIN_PRELOAD_THRESHOLD, max: MAX_PRELOAD_THRESHOLD, step: 0.1 },
}

function PreloadNumberSelector({ property }: { property: KeyOfPreloadConfig }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { preload } = translateConfig.page

  const currentConfigValue = preload[property]
  const constraints = propertyConstraints[property]
  const info = propertyInfo[property]

  return (
    <Field orientation="responsive">
      <FieldContent className="self-center">
        <FieldLabel htmlFor={`preload-${property}`}>
          {info.label()}
          <Hint content={info.description()} />
        </FieldLabel>
      </FieldContent>
      <Input
        id={`preload-${property}`}
        className="w-40 shrink-0"
        type="number"
        min={constraints.min}
        max={constraints.max}
        step={constraints.step}
        value={currentConfigValue}
        onChange={(e) => {
          const newConfigValue = Number(e.target.value)
          const configParseResult = preloadConfigSchema.partial().safeParse({ [property]: newConfigValue })
          if (configParseResult.success) {
            void setTranslateConfig({
              ...translateConfig,
              page: {
                ...translateConfig.page,
                preload: {
                  ...translateConfig.page.preload,
                  [property]: newConfigValue,
                },
              },
            })
          }
          else {
            toast.error(configParseResult.error?.issues[0].message)
          }
        }}
      />
    </Field>
  )
}
