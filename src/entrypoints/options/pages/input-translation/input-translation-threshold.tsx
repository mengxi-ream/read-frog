import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Field, FieldContent, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Input } from '@/components/shadcn/input'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

const MIN_THRESHOLD = 100
const MAX_THRESHOLD = 1000

export function InputTranslationThreshold() {
  const [inputTranslation, setInputTranslation] = useAtom(
    configFieldsAtomMap.inputTranslation,
  )

  return (
    <ConfigCard
      title={i18n.t('options.inputTranslation.threshold.title')}
      description={i18n.t('options.inputTranslation.threshold.description')}
    >
      <Field orientation="responsive">
        <FieldContent className="self-center">
          <FieldLabel htmlFor="input-translation-threshold">
            {i18n.t('options.inputTranslation.threshold.label')}
            <Hint content={i18n.t('options.inputTranslation.threshold.hint')} />
          </FieldLabel>
        </FieldContent>
        <Input
          id="input-translation-threshold"
          className="w-40 shrink-0"
          type="number"
          min={MIN_THRESHOLD}
          max={MAX_THRESHOLD}
          step={50}
          value={inputTranslation.timeThreshold}
          onChange={(e) => {
            const newValue = Number(e.target.value)
            if (newValue >= MIN_THRESHOLD && newValue <= MAX_THRESHOLD) {
              void setInputTranslation({
                ...inputTranslation,
                timeThreshold: newValue,
              })
            }
            else {
              toast.error(i18n.t('options.inputTranslation.threshold.error', [MIN_THRESHOLD, MAX_THRESHOLD]))
            }
          }}
          onBlur={(e) => {
            // Format and clamp value on blur (removes leading zeros like 0000300 → 300)
            const rawValue = Number(e.target.value)
            const clampedValue = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, rawValue || MIN_THRESHOLD))
            void setInputTranslation({
              ...inputTranslation,
              timeThreshold: clampedValue,
            })
          }}
        />
      </Field>
    </ConfigCard>
  )
}
