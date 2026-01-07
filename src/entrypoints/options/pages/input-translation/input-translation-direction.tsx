import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { Label } from '@/components/shadcn/label'
import { RadioGroup, RadioGroupItem } from '@/components/shadcn/radio-group'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function InputTranslationDirection() {
  const [inputTranslation, setInputTranslation] = useAtom(
    configFieldsAtomMap.inputTranslation,
  )

  return (
    <ConfigCard
      title={i18n.t('options.inputTranslation.direction.title')}
      description={i18n.t('options.inputTranslation.direction.description')}
    >
      <RadioGroup
        value={inputTranslation.direction}
        onValueChange={(value: 'normal' | 'reverse' | 'cycle') => {
          void setInputTranslation({
            ...inputTranslation,
            direction: value,
          })
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="normal" id="direction-normal" />
          <Label htmlFor="direction-normal" className="cursor-pointer">
            {i18n.t('options.inputTranslation.direction.normal')}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="reverse" id="direction-reverse" />
          <Label htmlFor="direction-reverse" className="cursor-pointer">
            {i18n.t('options.inputTranslation.direction.reverse')}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="cycle" id="direction-cycle" />
          <Label htmlFor="direction-cycle" className="cursor-pointer">
            {i18n.t('options.inputTranslation.direction.cycle')}
          </Label>
        </div>
      </RadioGroup>
    </ConfigCard>
  )
}
