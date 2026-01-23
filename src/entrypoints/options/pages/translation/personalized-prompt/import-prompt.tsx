import type { PromptConfigList } from './utils/prompt-file'
import { i18n } from '#imports'
import { Icon } from '@iconify/react/dist/iconify.js'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { Button } from '@/components/base-ui/button'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { analysisJSONFile } from './utils/prompt-file'

export function ImportPrompts() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  const injectPrompts = (list: PromptConfigList) => {
    const originPatterns = translateConfig.customPromptsConfig.patterns
    const patterns = list.map(item => ({
      ...item,
      id: crypto.randomUUID(),
      // Backwards compatibility: add systemPrompt if missing from imported file
      systemPrompt: item.systemPrompt ?? '',
    }))

    void setTranslateConfig({
      customPromptsConfig: {
        ...translateConfig.customPromptsConfig,
        patterns: [...originPatterns, ...patterns],
      },
    })
  }

  const importPrompts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files
      if (!files || !files[0])
        return
      const config = await analysisJSONFile(files[0])
      injectPrompts(config)
      toast.success(`${i18n.t('options.translation.personalizedPrompts.importSuccess')} !`)
    }
    catch (error) {
      if (error instanceof Error) {
        toast.error(error.message)
      }
      else {
        toast.error('Something went error when importing')
      }
    }
    finally {
      e.target.value = ''
      e.target.files = null
    }
  }

  return (
    <Button variant="outline" className="p-0">
      <Label htmlFor="import-file" className="w-full px-3">
        <Icon icon="tabler:file-import" className="size-4" />
        {i18n.t('options.translation.personalizedPrompts.import')}
      </Label>
      <Input
        type="file"
        id="import-file"
        className="hidden"
        accept=".json"
        onChange={importPrompts}
      >
      </Input>
    </Button>
  )
}
