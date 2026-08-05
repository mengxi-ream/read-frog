import type { TranslatePromptObj } from "@/types/config/translate"
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
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { useBuiltInPrompts, usePromptAtoms, usePromptInsertCells } from "./context"

function createBlankPrompt(): TranslatePromptObj {
  return { id: getRandomUUID(), name: "", systemPrompt: "", prompt: "" }
}

export function ConfigurePrompt({
  originPrompt,
  className,
  ...props
}: {
  originPrompt?: TranslatePromptObj
  className?: string
} & React.ComponentProps<"button">) {
  const promptAtoms = usePromptAtoms()
  const insertCells = usePromptInsertCells()
  const builtInPrompts = useBuiltInPrompts()
  const [config, setConfig] = useAtom(promptAtoms.config)
  const isExportMode = useAtomValue(promptAtoms.exportMode)

  const isBuiltIn =
    originPrompt !== undefined && builtInPrompts.some(({ id }) => id === originPrompt.id)
  const isEditingCustomPrompt = originPrompt !== undefined && !isBuiltIn
  const [isCopyingBuiltIn, setIsCopyingBuiltIn] = useState(false)
  const isReadOnly = isBuiltIn && !isCopyingBuiltIn

  const [prompt, setPrompt] = useState<TranslatePromptObj>(
    () => originPrompt ?? createBlankPrompt(),
  )

  const resetPrompt = () => {
    setIsCopyingBuiltIn(false)
    setPrompt(originPrompt ?? createBlankPrompt())
  }

  const sheetTitle = isReadOnly
    ? (originPrompt?.name ?? "")
    : isCopyingBuiltIn
      ? i18n.t("options.translation.personalizedPrompts.copyAndCustomize")
      : isEditingCustomPrompt
        ? i18n.t("options.translation.personalizedPrompts.editPrompt.title")
        : i18n.t("options.translation.personalizedPrompts.addPrompt")

  const configurePrompt = () => {
    const _patterns = config.patterns

    setConfig({
      ...config,
      patterns: isEditingCustomPrompt
        ? _patterns.map((p) => (p.id === prompt.id ? prompt : p))
        : [..._patterns, prompt],
      promptId: isCopyingBuiltIn ? prompt.id : config.promptId,
    })
  }

  const copyBuiltInPrompt = () => {
    if (!originPrompt) return

    setPrompt({
      id: getRandomUUID(),
      name: i18n.t("options.translation.personalizedPrompts.copyName", [originPrompt.name]),
      systemPrompt: originPrompt.systemPrompt,
      prompt: originPrompt.prompt,
    })
    setIsCopyingBuiltIn(true)
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) {
          resetPrompt()
        }
      }}
    >
      {originPrompt ? (
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              className={cn("size-8", className)}
              disabled={isExportMode}
              {...props}
            />
          }
        >
          <Icon icon={isBuiltIn ? "tabler:eye" : "tabler:pencil"} className="size-4" />
        </SheetTrigger>
      ) : (
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
            <FieldLabel htmlFor="prompt-name">
              {i18n.t("options.translation.personalizedPrompts.editPrompt.name")}
            </FieldLabel>
            <Input
              id="prompt-name"
              value={prompt.name}
              disabled={isReadOnly}
              onChange={(e) => {
                setPrompt({
                  ...prompt,
                  name: e.target.value,
                })
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="system-prompt">
              {i18n.t("options.translation.personalizedPrompts.editPrompt.systemPrompt")}
            </FieldLabel>
            <QuickInsertableTextarea
              value={prompt.systemPrompt}
              className="max-h-80 min-h-40"
              disabled={isReadOnly}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setPrompt({ ...prompt, systemPrompt: e.target.value })
              }
              insertCells={insertCells}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="prompt">
              {i18n.t("options.translation.personalizedPrompts.editPrompt.prompt")}
            </FieldLabel>
            <QuickInsertableTextarea
              value={prompt.prompt}
              className="max-h-60"
              disabled={isReadOnly}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setPrompt({ ...prompt, prompt: e.target.value })
              }
              insertCells={insertCells}
            />
          </Field>
        </FieldGroup>
        {isReadOnly ? (
          <SheetFooter>
            <Button onClick={copyBuiltInPrompt}>
              <Icon icon="tabler:copy" className="size-4" />
              {i18n.t("options.translation.personalizedPrompts.copyAndCustomize")}
            </Button>
            <SheetClose render={<Button variant="outline" />}>
              {i18n.t("options.translation.personalizedPrompts.editPrompt.close")}
            </SheetClose>
          </SheetFooter>
        ) : (
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
