import type { TranslatePromptObj } from "@/types/config/translate"
import { useAtom, useAtomValue } from "jotai"
import { useId } from "react"
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
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { ConfigurePrompt } from "./configure-prompt"
import { useBuiltInPrompts, usePromptAtoms } from "./context"
import { DeletePrompt } from "./delete-prompt"

export function PromptGrid({
  currentPromptId,
  setCurrentPromptId,
}: {
  currentPromptId: string
  setCurrentPromptId: (value: string) => void
}) {
  const promptAtoms = usePromptAtoms()
  const config = useAtomValue(promptAtoms.config)
  const [selectedPrompts, setSelectedPrompts] = useAtom(promptAtoms.selectedPrompts)
  const isExportMode = useAtomValue(promptAtoms.exportMode)
  const builtInPrompts = useBuiltInPrompts()

  const patterns = config.patterns
  const checkboxBaseId = useId()
  const builtInPromptIds = new Set(builtInPrompts.map(({ id }) => id))
  const allPrompts: TranslatePromptObj[] = [...builtInPrompts, ...patterns]

  async function handleCardClick(pattern: (typeof allPrompts)[number]) {
    const isBuiltIn = builtInPromptIds.has(pattern.id)

    if (!isExportMode) {
      setCurrentPromptId(pattern.id)
    } else if (!isBuiltIn) {
      // Code-owned prompts are never exportable.
      setSelectedPrompts((prev) => {
        return prev.includes(pattern.id)
          ? prev.filter((id) => id !== pattern.id)
          : [...prev, pattern.id]
      })
    }
  }

  return (
    <div
      aria-label={i18n.t("options.translation.personalizedPrompts.title")}
      className="grid max-h-96 grid-cols-1 gap-4 overflow-auto p-2 select-none md:grid-cols-2 lg:grid-cols-4"
    >
      {allPrompts.map((pattern) => {
        const isBuiltIn = builtInPromptIds.has(pattern.id)
        const isActive = currentPromptId === pattern.id
        const description =
          "description" in pattern && typeof pattern.description === "string"
            ? pattern.description
            : undefined

        return (
          <Card
            className={cn(
              "h-full cursor-pointer gap-0 py-0 pb-2 transition-transform duration-30 ease-in-out hover:scale-[1.02]",
              // for highlight checked card in export mode
              isExportMode
                ? "has-aria-checked:border-primary has-aria-checked:bg-primary/5 dark:has-aria-checked:border-primary/70 dark:has-aria-checked:bg-primary/10"
                : "",
            )}
            key={pattern.id}
          >
            <CardHeader
              className="mb-3 grid-rows-1 px-4 pt-4"
              onClick={() => handleCardClick(pattern)}
            >
              <CardTitle className="w-full min-w-0">
                <div className="flex h-5 w-full items-center gap-3 leading-relaxed">
                  {isExportMode && !isBuiltIn && (
                    <Checkbox
                      id={`${checkboxBaseId}-check-${pattern.id}`}
                      checked={selectedPrompts.includes(pattern.id)}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={(checked) => {
                        setSelectedPrompts((prev) => {
                          return checked
                            ? [...prev, pattern.id]
                            : prev.filter((id) => id !== pattern.id)
                        })
                      }}
                    />
                  )}
                  <Label
                    htmlFor={`${checkboxBaseId}-check-${pattern.id}`}
                    className="block min-w-0 flex-1 cursor-pointer truncate"
                    title={pattern.name}
                  >
                    {pattern.name}
                  </Label>
                  {isBuiltIn && (
                    <Badge variant="secondary" size="sm">
                      {i18n.t("options.translation.personalizedPrompts.builtIn")}
                    </Badge>
                  )}
                  {isActive && (
                    <Badge className="bg-primary">
                      {i18n.t("options.translation.personalizedPrompts.current")}
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent
              className="mb-3 flex h-16 flex-1 flex-col gap-4 px-4"
              onClick={() => handleCardClick(pattern)}
            >
              <p className="line-clamp-3 text-sm text-ellipsis whitespace-pre-wrap">
                {description ??
                  (pattern.systemPrompt && pattern.prompt
                    ? `${pattern.systemPrompt}\n---\n${pattern.prompt}`
                    : pattern.systemPrompt || pattern.prompt)}
              </p>
            </CardContent>
            <Separator className="my-0" />
            <CardFooter
              className={cn(
                "flex w-full cursor-default items-center px-4 py-2",
                isBuiltIn ? "justify-end" : "justify-between",
              )}
            >
              {isBuiltIn ? (
                <CardAction>
                  <ConfigurePrompt originPrompt={pattern} />
                </CardAction>
              ) : (
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
      })}
    </div>
  )
}
