import type { TranslatePromptObj } from "@/types/config/translate"
import { i18n } from "#imports"
import { Icon } from "@iconify/react/dist/iconify.js"
import { useAtom, useAtomValue } from "jotai"
import { useState } from "react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { usePromptAtoms } from "./context"

export function DeletePrompt({
  originPrompt,
  className,
  ...props
}: {
  originPrompt: TranslatePromptObj
  className?: string
} & React.ComponentProps<"button">) {
  const promptAtoms = usePromptAtoms()
  const isExportMode = useAtomValue(promptAtoms.exportMode)
  const [config, setConfig] = useAtom(promptAtoms.config)

  const { patterns, promptId } = config

  const [open, setOpen] = useState(false)

  const deletePrompt = () => {
    setConfig({
      ...config,
      patterns: patterns.filter(p => p.id !== originPrompt.id),
      promptId: promptId !== originPrompt.id ? promptId : null,
    })
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" className={className} disabled={isExportMode} {...props} />}>
        <Icon icon="tabler:trash" className="size-4"></Icon>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t("options.translation.personalizedPrompts.deletePrompt.title")}
            {" "}
            :
            {" "}
            {originPrompt.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t("options.translation.personalizedPrompts.deletePrompt.description")}
            {" "}
            ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n.t("options.translation.personalizedPrompts.deletePrompt.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={deletePrompt}>{i18n.t("options.translation.personalizedPrompts.deletePrompt.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
