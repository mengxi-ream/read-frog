import type { PromptConfigList } from '../../utils/prompt-file'
import type { TranslatePrompt } from '@/types/config/provider'
import { useAtom, useAtomValue } from 'jotai'
import { FileDown, FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { configFields } from '@/utils/atoms/config'
import { DEFAULT_TRANSLATE_PROMPT_ID } from '@/utils/constants/prompt'
import { ConfigCard } from '../../components/config-card'
import { analysisJSONFile, downloadJSONFile } from '../../utils/prompt-file'

const isDefaultPrompt = (id: string) => id === DEFAULT_TRANSLATE_PROMPT_ID

export function PersonalizedPrompt() {
  return (
    <ConfigCard className="lg:flex-col" title={i18n.t('options.translation.personalizedPrompt.title')} description={i18n.t('options.translation.personalizedPrompt.description')}>
      <PromptList />
    </ConfigCard>
  )
}

function PromptList() {
  const translateConfig = useAtomValue(configFields.translate)
  const promptsConfig = translateConfig.promptsConfig
  const patterns = promptsConfig.patterns
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([])

  return (
    <section className="w-full">
      <header className="w-full text-end mb-4 gap-3 flex justify-end">
        <ImportPrompts />
        <ExportPrompts selectedPrompts={selectedPrompts} />
        <ConfigurePrompt />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-96 overflow-auto p-2">
        {
          patterns.map(pattern => (
            <Card className="h-fit gap-4" key={pattern.id}>
              <CardHeader className="grid-rows-1">
                <CardTitle className="leading-relaxed">
                  {
                    isDefaultPrompt(pattern.id)
                      ? i18n.t('options.translation.personalizedPrompt.default')
                      : (
                          <div className="truncate leading-relaxed gap-3 flex items-center">
                            <Checkbox
                              id={`translate-prompt-${pattern.id}`}
                              checked={selectedPrompts.includes(pattern.id)}
                              onCheckedChange={(checked) => {
                                setSelectedPrompts((prev) => {
                                  return checked
                                    ? [...prev, pattern.id]
                                    : prev.filter(id => id !== pattern.id)
                                })
                              }}
                            >
                            </Checkbox>
                            {pattern.name}
                          </div>
                        )
                  }
                </CardTitle>
                <CardAction className="leading-relaxed">
                  {
                    isDefaultPrompt(pattern.id) ? <></> : <DeletePrompt originPrompt={pattern}></DeletePrompt>
                  }
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 h-16">
                <p className="text-sm text-ellipsis whitespace-pre-wrap line-clamp-3">{pattern.prompt}</p>
              </CardContent>
              <CardFooter className="w-full flex justify-end mt-8">
                <ConfigurePrompt originPrompt={pattern} />
              </CardFooter>
            </Card>
          ))
        }
      </div>
    </section>
  )
}

function DeletePrompt({ originPrompt }: { originPrompt: TranslatePrompt }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  const { patterns, prompt } = translateConfig.promptsConfig
  const deletePrompt = () => {
    setTranslateConfig({
      promptsConfig: {
        ...translateConfig.promptsConfig,
        patterns: patterns.filter(p => p.id !== originPrompt.id),
        prompt: prompt !== originPrompt.id ? prompt : DEFAULT_TRANSLATE_PROMPT_ID,
      },
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger>
        <Button className="size-4" variant="ghost">
          <Trash2 className="size-4"></Trash2>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t('options.translation.personalizedPrompt.deletePrompt.title')}
            {' '}
            :
            {' '}
            {originPrompt.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t('options.translation.personalizedPrompt.deletePrompt.description')}
            {' '}
            ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n.t('options.translation.personalizedPrompt.deletePrompt.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={deletePrompt}>{i18n.t('options.translation.personalizedPrompt.deletePrompt.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  )
}

function ConfigurePrompt({ originPrompt }: { originPrompt?: TranslatePrompt }) {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)

  const inEdit = !!originPrompt

  const [prompt, setPrompt] = useState<TranslatePrompt>(originPrompt ?? { id: crypto.randomUUID(), name: '', prompt: '' })

  const name = isDefaultPrompt(prompt.id)
    ? i18n.t('options.translation.personalizedPrompt.default')
    : prompt.name

  const sheetTitle = inEdit
    ? i18n.t('options.translation.personalizedPrompt.editPrompt.title')
    : i18n.t('options.translation.personalizedPrompt.addPrompt')

  const clearCachePrompt = () => {
    setPrompt({
      id: crypto.randomUUID(),
      name: '',
      prompt: '',
    })
  }

  const configurePrompt = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (!prompt.id || !prompt.name || !prompt.prompt) {
      event.preventDefault()
      return
    }

    const _patterns = translateConfig.promptsConfig.patterns

    setTranslateConfig({
      promptsConfig: {
        ...translateConfig.promptsConfig,
        patterns: inEdit
          ? _patterns.map(p => p.id === prompt.id ? prompt : p)
          : [..._patterns, prompt],
      },
    })

    clearCachePrompt()
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {
          inEdit
            ? (
                <Button className="size-8 rounded-full">
                  <Pencil className="size-4" />
                </Button>
              )
            : (
                <Button>
                  <Plus className="size-4" />
                  {i18n.t('options.translation.personalizedPrompt.addPrompt')}
                </Button>
              )
        }
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:w-[640px]">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <div className="grid flex-1 auto-rows-min gap-6 py-6">
            <div className="grid gap-3">
              <Label htmlFor="prompt-name">{i18n.t('options.translation.personalizedPrompt.editPrompt.name')}</Label>
              <Input
                id="prompt-name"
                value={name}
                disabled={isDefaultPrompt(prompt.id)}
                onChange={(e) => {
                  setPrompt({
                    ...prompt,
                    name: e.target.value,
                  })
                }}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt.prompt}
                onChange={(e) => {
                  setPrompt({
                    ...prompt,
                    prompt: e.target.value,
                  })
                }}
              />
            </div>
          </div>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button onClick={configurePrompt}>{i18n.t('options.translation.personalizedPrompt.editPrompt.save')}</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button variant="outline">{i18n.t('options.translation.personalizedPrompt.editPrompt.close')}</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ImportPrompts() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)

  const injectPrompts = (list: PromptConfigList) => {
    const originPatterns = translateConfig.promptsConfig.patterns
    const patterns = list.map(item => ({
      ...item,
      id: crypto.randomUUID(),
    }))

    setTranslateConfig({
      promptsConfig: {
        ...translateConfig.promptsConfig,
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
      toast.success(`${i18n.t('options.translation.personalizedPrompt.importSuccess')} !`)
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
        <FileDown className="size-4" />
        {i18n.t('options.translation.personalizedPrompt.import')}
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

function ExportPrompts({ selectedPrompts }: { selectedPrompts: string[] }) {
  const translateConfig = useAtomValue(configFields.translate)
  const promptsConfig = translateConfig.promptsConfig
  const patterns = promptsConfig.patterns

  const sortOutDownloadPrompts = patterns
    .filter(pattern => selectedPrompts.includes(pattern.id))
    .map(pattern => ({
      name: pattern.name,
      prompt: pattern.prompt,
    }))

  return (
    <Button
      variant="outline"
      onClick={() => {
        downloadJSONFile(sortOutDownloadPrompts)
      }}
      disabled={!selectedPrompts.length}
    >
      <FileUp className="size-4" />
      {i18n.t('options.translation.personalizedPrompt.export')}
    </Button>
  )
}
