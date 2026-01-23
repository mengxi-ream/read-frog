import type { TranslatePromptObj } from '@/types/config/translate'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Activity, useState } from 'react'
import { Button } from '@/components/base-ui/button'
import { Badge } from '@/components/shadcn/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/shadcn/card'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { Separator } from '@/components/shadcn/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/shadcn/sheet'
import { QuickInsertableTextarea } from '@/components/ui/insertable-textarea'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { DEFAULT_TRANSLATE_PROMPT, DEFAULT_TRANSLATE_PROMPT_ID, DEFAULT_TRANSLATE_SYSTEM_PROMPT, getTokenCellText, TOKENS } from '@/utils/constants/prompt'
import { cn } from '@/utils/styles/utils'
import { ConfigCard } from '../../../components/config-card'
import { isExportPromptModeAtom, selectedPromptsToExportAtom } from './atoms'
import { DeletePrompt } from './delete-prompt'
import { ExportPrompts } from './export-prompt'
import { ImportPrompts } from './import-prompt'

export function PersonalizedPrompts() {
  return (
    <ConfigCard
      className="lg:flex-col"
      title={i18n.t('options.translation.personalizedPrompts.title')}
      description={(
        <p>
          {i18n.t('options.translation.personalizedPrompts.description')}
          {' '}
          <a
            href={i18n.t('options.translation.personalizedPrompts.communityPromptsUrl')}
            target="_blank"
            rel="noreferrer noopener"
            className="text-link hover:underline"
          >
            {i18n.t('options.translation.personalizedPrompts.communityPrompts')}
          </a>
        </p>
      )}
    >
      <PromptList />
    </ConfigCard>
  )
}

function PromptList() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const customPromptsConfig = translateConfig.customPromptsConfig
  const patterns = customPromptsConfig.patterns
  const setSelectedPrompts = useSetAtom(selectedPromptsToExportAtom)
  const [isExportMode, setIsExportMode] = useAtom(isExportPromptModeAtom)
  const currentPromptId = customPromptsConfig.promptId

  const setCurrentPromptId = (value: string | null) => {
    void setTranslateConfig({
      customPromptsConfig: {
        ...customPromptsConfig,
        promptId: value,
      },
    })
  }

  return (
    <section className="w-full">
      <div className="w-full text-end mb-4 gap-3 flex justify-end">
        {
          isExportMode
            ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsExportMode(false)
                      setSelectedPrompts([])
                    }}
                  >
                    <Icon icon="tabler:x" className="size-4" />
                    {i18n.t('options.translation.personalizedPrompts.exportPrompt.cancel')}
                  </Button>
                  <ExportPrompts />
                </>
              )
            : (
                <>
                  <ImportPrompts />
                  <Button
                    variant="outline"
                    onClick={() => setIsExportMode(true)}
                    disabled={patterns.length === 0}
                  >
                    <Icon icon="tabler:file-import" className="size-4" />
                    {i18n.t('options.translation.personalizedPrompts.export')}
                  </Button>
                  <ConfigurePrompt />
                </>
              )
        }
      </div>
      <PromptGrid
        currentPromptId={currentPromptId}
        setCurrentPromptId={setCurrentPromptId}
      />
    </section>
  )
}

function PromptGrid({
  currentPromptId,
  setCurrentPromptId,
}: {
  currentPromptId: string | null
  setCurrentPromptId: (value: string | null) => void
}) {
  const [translateConfig] = useAtom(configFieldsAtomMap.translate)
  const customPromptsConfig = translateConfig.customPromptsConfig
  const patterns = customPromptsConfig.patterns
  const [selectedPrompts, setSelectedPrompts] = useAtom(selectedPromptsToExportAtom)
  const isExportMode = useAtomValue(isExportPromptModeAtom)

  // Construct virtual default prompt object from code constant
  const defaultPrompt: TranslatePromptObj = {
    id: DEFAULT_TRANSLATE_PROMPT_ID,
    name: i18n.t('options.translation.personalizedPrompts.default'),
    systemPrompt: DEFAULT_TRANSLATE_SYSTEM_PROMPT,
    prompt: DEFAULT_TRANSLATE_PROMPT,
  }

  // Prepend default to patterns list
  const allPrompts = [defaultPrompt, ...patterns]

  async function handleCardClick(pattern: typeof allPrompts[number]) {
    const isDefault = pattern.id === DEFAULT_TRANSLATE_PROMPT_ID

    if (!isExportMode) {
      setCurrentPromptId(isDefault ? null : pattern.id)
    }
    else if (!isDefault) {
      // In export mode, only allow selecting custom prompts (not default)
      setSelectedPrompts((prev) => {
        return prev.includes(pattern.id)
          ? prev.filter(id => id !== pattern.id)
          : [...prev, pattern.id]
      })
    }
  }

  return (
    <div
      aria-label={i18n.t('options.translation.personalizedPrompts.title')}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-96 overflow-auto p-2 select-none"
    >
      {
        allPrompts.map((pattern) => {
          const isDefault = pattern.id === DEFAULT_TRANSLATE_PROMPT_ID
          const isActive = isDefault ? currentPromptId === null : currentPromptId === pattern.id

          return (
            <Card
              className={cn(
                'h-full gap-0 pb-2 py-0 cursor-pointer hover:scale-[1.02] transition-transform duration-30 ease-in-out',
                // for highlight checked card in export mode
                isExportMode ? 'has-aria-checked:border-primary has-aria-checked:bg-primary/5 dark:has-aria-checked:border-primary/70 dark:has-aria-checked:bg-primary/10' : '',
              )}
              key={pattern.id}
            >
              <CardHeader
                className="grid-rows-1 pt-4 px-4 mb-3"
                onClick={() => handleCardClick(pattern)}
              >
                <CardTitle className="w-full min-w-0">
                  <div className="leading-relaxed gap-3 flex items-center w-full h-5">
                    {/* Checkbox: only show in export mode for custom prompts (not default) */}
                    <Activity mode={isExportMode && !isDefault ? 'visible' : 'hidden'}>
                      <Checkbox
                        id={`translate-prompt-check-${pattern.id}`}
                        checked={selectedPrompts.includes(pattern.id)}
                        onCheckedChange={(checked) => {
                          setSelectedPrompts((prev) => {
                            return checked
                              ? [...prev, pattern.id]
                              : prev.filter(id => id !== pattern.id)
                          })
                        }}
                      />
                    </Activity>
                    <Label
                      htmlFor={`translate-prompt-check-${isExportMode ? 'check' : 'radio'}-${pattern.id}`}
                      className="flex-1 min-w-0 block truncate cursor-pointer"
                      title={pattern.name}
                    >
                      {pattern.name}
                    </Label>
                    <Activity mode={isActive ? 'visible' : 'hidden'}>
                      <Badge className="bg-primary">
                        {i18n.t('options.translation.personalizedPrompts.current')}
                      </Badge>
                    </Activity>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent
                className="flex flex-col gap-4 h-16 flex-1 px-4 mb-3"
                onClick={() => handleCardClick(pattern)}
              >
                <p className="text-sm text-ellipsis whitespace-pre-wrap line-clamp-3">
                  {pattern.systemPrompt && pattern.prompt
                    ? `${pattern.systemPrompt}\n---\n${pattern.prompt}`
                    : pattern.systemPrompt || pattern.prompt}
                </p>
              </CardContent>
              <Separator className="my-0" />
              <CardFooter className="w-full flex justify-between px-4 items-center py-2 cursor-default">
                {isDefault
                  ? (
                    // Default prompt: show eye icon (view only)
                      <CardAction>
                        <ConfigurePrompt originPrompt={pattern} />
                      </CardAction>
                    )
                  : (
                    // Custom prompts: show delete + edit
                      <>
                        <CardAction>
                          <DeletePrompt originPrompt={pattern} />
                        </CardAction>
                        <CardAction>
                          <ConfigurePrompt originPrompt={pattern} />
                        </CardAction>
                      </>
                    )}
              </CardFooter>
            </Card>
          )
        })
      }
    </div>
  )
}

function ConfigurePrompt({
  originPrompt,
  className,
  ...props
}: {
  originPrompt?: TranslatePromptObj
  className?: string
} & React.ComponentProps<'button'>) {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const isExportMode = useAtomValue(isExportPromptModeAtom)
  const inEdit = !!originPrompt
  const isDefault = originPrompt?.id === DEFAULT_TRANSLATE_PROMPT_ID

  const defaultPrompt = { id: crypto.randomUUID(), name: '', systemPrompt: '', prompt: '' }
  const initialPrompt = originPrompt ?? defaultPrompt

  const [prompt, setPrompt] = useState<TranslatePromptObj>(initialPrompt)

  const resetPrompt = () => {
    setPrompt(originPrompt ?? defaultPrompt)
  }

  const sheetTitle = isDefault
    ? i18n.t('options.translation.personalizedPrompts.default')
    : inEdit
      ? i18n.t('options.translation.personalizedPrompts.editPrompt.title')
      : i18n.t('options.translation.personalizedPrompts.addPrompt')

  const clearCachePrompt = () => {
    setPrompt({
      id: crypto.randomUUID(),
      name: '',
      systemPrompt: '',
      prompt: '',
    })
  }

  const configurePrompt = () => {
    const _patterns = translateConfig.customPromptsConfig.patterns

    void setTranslateConfig({
      customPromptsConfig: {
        ...translateConfig.customPromptsConfig,
        patterns: inEdit
          ? _patterns.map(p => p.id === prompt.id ? prompt : p)
          : [..._patterns, prompt],
      },
    })

    clearCachePrompt()
  }

  return (
    <Sheet onOpenChange={(open) => {
      if (open) {
        resetPrompt()
      }
    }}
    >
      <SheetTrigger asChild>
        {
          inEdit
            ? (
                <Button variant="ghost" className={cn('size-8', className)} disabled={isExportMode} {...props}>
                  <Icon icon={isDefault ? 'tabler:eye' : 'tabler:pencil'} className="size-4" />
                </Button>
              )
            : (
                <Button className={className} {...props}>
                  <Icon icon="tabler:plus" className="size-4" />
                  {i18n.t('options.translation.personalizedPrompts.addPrompt')}
                </Button>
              )
        }
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
        </SheetHeader>
        <FieldGroup className="flex-1 overflow-y-auto px-4">
          <Field>
            <FieldLabel htmlFor="prompt-name">{i18n.t('options.translation.personalizedPrompts.editPrompt.name')}</FieldLabel>
            <Input
              id="prompt-name"
              value={prompt.name}
              disabled={isDefault}
              onChange={(e) => {
                setPrompt({
                  ...prompt,
                  name: e.target.value,
                })
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="system-prompt">{i18n.t('options.translation.personalizedPrompts.editPrompt.systemPrompt')}</FieldLabel>
            <QuickInsertableTextarea
              value={prompt.systemPrompt}
              className="min-h-40 max-h-80"
              disabled={isDefault}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt({ ...prompt, systemPrompt: e.target.value })}
              insertCells={TOKENS.map(token => ({
                text: getTokenCellText(token),
                description: i18n.t(`options.translation.personalizedPrompts.editPrompt.promptCellInput.${token}`),
              }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="prompt">{i18n.t('options.translation.personalizedPrompts.editPrompt.prompt')}</FieldLabel>
            <QuickInsertableTextarea
              value={prompt.prompt}
              className="max-h-60"
              disabled={isDefault}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt({ ...prompt, prompt: e.target.value })}
              insertCells={TOKENS.map(token => ({
                text: getTokenCellText(token),
                description: i18n.t(`options.translation.personalizedPrompts.editPrompt.promptCellInput.${token}`),
              }))}
            />
          </Field>
        </FieldGroup>
        {!isDefault && (
          <SheetFooter>
            <SheetClose asChild>
              <Button onClick={configurePrompt}>{i18n.t('options.translation.personalizedPrompts.editPrompt.save')}</Button>
            </SheetClose>
            <SheetClose asChild>
              <Button variant="outline">{i18n.t('options.translation.personalizedPrompts.editPrompt.close')}</Button>
            </SheetClose>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
