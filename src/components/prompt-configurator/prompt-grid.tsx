import type { TranslatePromptObj } from "@/types/config/translate"
import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import { Activity, useId } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/base-ui/card"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { Label } from "@/components/ui/base-ui/label"
import { Separator } from "@/components/ui/base-ui/separator"
import { DEFAULT_TRANSLATE_PROMPT, DEFAULT_TRANSLATE_PROMPT_ID, DEFAULT_TRANSLATE_SYSTEM_PROMPT } from "@/utils/constants/prompt"
import { cn } from "@/utils/styles/utils"
import { ConfigurePrompt } from "./configure-prompt"
import { usePromptAtoms } from "./context"
import { DeletePrompt } from "./delete-prompt"

export function PromptGrid({
  currentPromptId,
  setCurrentPromptId,
}: {
  currentPromptId: string | null
  setCurrentPromptId: (value: string | null) => void
}) {
  const promptAtoms = usePromptAtoms()
  const config = useAtomValue(promptAtoms.config)
  const [selectedPrompts, setSelectedPrompts] = useAtom(promptAtoms.selectedPrompts)
  const isExportMode = useAtomValue(promptAtoms.exportMode)

  const patterns = config.patterns
  const idPrefix = useId()

  // Construct virtual default prompt object from code constant
  const defaultPrompt: TranslatePromptObj = {
    id: DEFAULT_TRANSLATE_PROMPT_ID,
    name: i18n.t("options.translation.personalizedPrompts.default"),
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
      aria-label={i18n.t("options.translation.personalizedPrompts.title")}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-96 overflow-auto p-2 select-none"
    >
      {
        allPrompts.map((pattern) => {
          const isDefault = pattern.id === DEFAULT_TRANSLATE_PROMPT_ID
          const isActive = isDefault ? currentPromptId === null : currentPromptId === pattern.id

          return (
            <Card
              className={cn(
                "h-full gap-0 pb-2 py-0 cursor-pointer hover:scale-[1.02] transition-transform duration-30 ease-in-out",
                // for highlight checked card in export mode
                isExportMode ? "has-aria-checked:border-primary has-aria-checked:bg-primary/5 dark:has-aria-checked:border-primary/70 dark:has-aria-checked:bg-primary/10" : "",
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
                    <Activity mode={isExportMode && !isDefault ? "visible" : "hidden"}>
                      <Checkbox
                        id={`${idPrefix}-check-${pattern.id}`}
                        checked={selectedPrompts.includes(pattern.id)}
                        onClick={e => e.stopPropagation()}
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
                      htmlFor={`${idPrefix}-check-${pattern.id}`}
                      className="flex-1 min-w-0 block truncate cursor-pointer"
                      title={pattern.name}
                    >
                      {pattern.name}
                    </Label>
                    <Activity mode={isActive ? "visible" : "hidden"}>
                      <Badge className="bg-primary">
                        {i18n.t("options.translation.personalizedPrompts.current")}
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
                <Activity mode={isDefault ? "visible" : "hidden"}>
                  <CardAction>
                    <ConfigurePrompt originPrompt={pattern} />
                  </CardAction>
                </Activity>
                <Activity mode={isDefault ? "hidden" : "visible"}>
                  <CardAction>
                    <DeletePrompt originPrompt={pattern} />
                  </CardAction>
                  <CardAction>
                    <ConfigurePrompt originPrompt={pattern} />
                  </CardAction>
                </Activity>
              </CardFooter>
            </Card>
          )
        })
      }
    </div>
  )
}
