import type { TranslatePromptObj } from "@/types/config/translate"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/base-ui/sheet"
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea"
import { DEFAULT_TRANSLATE_PROMPT_ID, getTokenCellText, TOKENS } from "@/utils/constants/prompt"
import { cn } from "@/utils/styles/utils"
import { usePromptAtoms } from "./context"

export function ConfigurePrompt({
  originPrompt,
  className,
  ...props
}: {
  originPrompt?: TranslatePromptObj
  className?: string
} & React.ComponentProps<"button">) {
  const promptAtoms = usePromptAtoms()
  const [config, setConfig] = useAtom(promptAtoms.config)
  const isExportMode = useAtomValue(promptAtoms.exportMode)

  const inEdit = !!originPrompt
  const isDefault = originPrompt?.id === DEFAULT_TRANSLATE_PROMPT_ID

  const defaultPrompt = { id: crypto.randomUUID(), name: "", systemPrompt: "", prompt: "" }
  const initialPrompt = originPrompt ?? defaultPrompt

  const [prompt, setPrompt] = useState<TranslatePromptObj>(initialPrompt)

  const resetPrompt = () => {
    setPrompt(originPrompt ?? defaultPrompt)
  }

  const sheetTitle = isDefault
    ? i18n.t("options.translation.personalizedPrompts.default")
    : inEdit
      ? i18n.t("options.translation.personalizedPrompts.editPrompt.title")
      : i18n.t("options.translation.personalizedPrompts.addPrompt")

  const clearCachePrompt = () => {
    setPrompt({
      id: crypto.randomUUID(),
      name: "",
      systemPrompt: "",
      prompt: "",
    })
  }

  const configurePrompt = () => {
    const _patterns = config.patterns

    setConfig({
      ...config,
      patterns: inEdit
        ? _patterns.map(p => p.id === prompt.id ? prompt : p)
        : [..._patterns, prompt],
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
      {inEdit
        ? (
            <SheetTrigger render={<Button variant="ghost" className={cn("size-8", className)} disabled={isExportMode} {...props} />}>
              <Icon icon={isDefault ? "tabler:eye" : "tabler:pencil"} className="size-4" />
            </SheetTrigger>
          )
        : (
            <SheetTrigger render={<Button className={className} {...props} />}>
              <Icon icon="tabler:plus" className="size-4" />
              {i18n.t("options.translation.personalizedPrompts.addPrompt")}
            </SheetTrigger>
          )}
      <SheetContent className="w-[400px] sm:w-[500px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
        </SheetHeader>
        <FieldGroup className="flex-1 overflow-y-auto px-4">
          <Field>
            <FieldLabel htmlFor="prompt-name">{i18n.t("options.translation.personalizedPrompts.editPrompt.name")}</FieldLabel>
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
            <FieldLabel htmlFor="system-prompt">{i18n.t("options.translation.personalizedPrompts.editPrompt.systemPrompt")}</FieldLabel>
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
            <FieldLabel htmlFor="prompt">{i18n.t("options.translation.personalizedPrompts.editPrompt.prompt")}</FieldLabel>
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
            <SheetClose render={<Button onClick={configurePrompt} />}>
              {i18n.t("options.translation.personalizedPrompts.editPrompt.save")}
            </SheetClose>
            <SheetClose render={<Button variant="outline" />}>
              {i18n.t("options.translation.personalizedPrompts.editPrompt.close")}
            </SheetClose>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
