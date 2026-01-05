import { i18n } from '#imports'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Input } from '@/components/shadcn/input'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MAX_CHARACTERS_PER_NODE, MIN_CHARACTERS_PER_NODE } from '@/utils/constants/translate'
import { ConfigCard } from '../../components/config-card'

export function MinCharactersConfig() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { minCharactersPerNode } = translateConfig.page

  return (
    <ConfigCard
      title={i18n.t('options.translation.minCharactersConfig.title')}
      description={i18n.t('options.translation.minCharactersConfig.description')}
    >
      <FieldGroup>
        <Field orientation="responsive">
          <FieldContent className="self-center">
            <FieldLabel htmlFor="min-characters-per-node">
              {i18n.t('options.translation.minCharactersConfig.minCharacters.title')}
              <Hint content={i18n.t('options.translation.minCharactersConfig.minCharacters.description')} />
            </FieldLabel>
          </FieldContent>
          <Input
            id="min-characters-per-node"
            className="w-40 shrink-0"
            type="number"
            min={MIN_CHARACTERS_PER_NODE}
            max={MAX_CHARACTERS_PER_NODE}
            step={1}
            value={minCharactersPerNode}
            onChange={(e) => {
              const newValue = Number(e.target.value)
              if (newValue >= MIN_CHARACTERS_PER_NODE && newValue <= MAX_CHARACTERS_PER_NODE) {
                void setTranslateConfig({
                  ...translateConfig,
                  page: {
                    ...translateConfig.page,
                    minCharactersPerNode: newValue,
                  },
                })
              }
              else {
                toast.error(i18n.t('options.translation.minCharactersConfig.error', [MIN_CHARACTERS_PER_NODE, MAX_CHARACTERS_PER_NODE]))
              }
            }}
          />
        </Field>
      </FieldGroup>
    </ConfigCard>
  )
}
