import { useAtom } from "jotai"
import { Field, FieldContent, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { toastManager } from "@/components/ui/base-ui/toast"
import { MAX_FAMILIAR_WORD_RANK } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"

export function VocabularyConfig() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { familiarWordRank } = translateConfig.vocabulary

  return (
    <ConfigCard
      id="vocabulary-config"
      title={i18n.t("options.translation.vocabularyConfig.title")}
      description={i18n.t("options.translation.vocabularyConfig.description")}
    >
      <Field orientation="responsive">
        <FieldContent className="self-center">
          <FieldLabel htmlFor="familiar-word-rank">
            {i18n.t("options.translation.vocabularyConfig.familiarWordRank.title")}
          </FieldLabel>
        </FieldContent>
        <Input
          id="familiar-word-rank"
          className="w-40 shrink-0"
          type="number"
          min={0}
          max={MAX_FAMILIAR_WORD_RANK}
          step={100}
          value={familiarWordRank}
          onChange={(e) => {
            const newValue = Number(e.target.value)
            if (newValue >= 0 && newValue <= MAX_FAMILIAR_WORD_RANK) {
              void setTranslateConfig({
                ...translateConfig,
                vocabulary: {
                  ...translateConfig.vocabulary,
                  familiarWordRank: newValue,
                },
              })
            } else {
              toastManager.add({
                type: "error",
                title: i18n.t("options.translation.vocabularyConfig.error", [
                  0,
                  MAX_FAMILIAR_WORD_RANK,
                ]),
              })
            }
          }}
        />
      </Field>
    </ConfigCard>
  )
}
