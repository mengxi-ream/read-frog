import { Icon } from "@iconify/react"
import { Fragment } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { toastManager } from "@/components/ui/base-ui/toast"
import { MAX_GLOSSARIES } from "@/utils/constants/glossary"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { GlossaryListItem } from "./glossary-list-item"
import { useCreateGlossary, useGlossaries, useGlossaryTermCounts } from "./use-glossary"

/**
 * The library: the button that adds a glossary, and the glossaries themselves
 * directly beneath it, so a new one appears exactly where the eye already is.
 */
export function GlossaryLibraryItem() {
  const { data: glossaries = [], isPending } = useGlossaries()
  const { data: termCounts } = useGlossaryTermCounts()
  const { mutateAsync: create, isPending: isCreating } = useCreateGlossary()

  const handleCreate = async () => {
    const result = await create()
    if (!result.ok) {
      toastManager.add({
        type: "error",
        title: i18n.t("options.advanced.glossary.library.capReached", [String(MAX_GLOSSARIES)]),
      })
    }
  }

  return (
    <ConfigItem
      id="glossary-library"
      orientation="vertical"
      title={i18n.t("options.advanced.glossary.library.title")}
      description={i18n.t("options.advanced.glossary.library.description")}
    >
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={isCreating || glossaries.length >= MAX_GLOSSARIES}
          onClick={() => void handleCreate()}
        >
          <Icon icon="tabler:plus" />
          {i18n.t("options.advanced.glossary.library.button")}
        </Button>

        {/* Nothing is said while the first read is in flight: a "no glossaries"
            line that flashes and is replaced reads as data loss. */}
        {!isPending && glossaries.length === 0 && (
          <p className="text-[13px] text-muted-foreground">
            {i18n.t("options.advanced.glossary.noGlossaries")}
          </p>
        )}

        {glossaries.length > 0 && (
          <div className="mt-1 flex flex-col">
            {glossaries.map((glossary, index) => (
              <Fragment key={glossary.id}>
                {/* A separate element rather than `divide-y`: that puts the rule
                    on the row itself, where the row's own `rounded-lg` — there
                    for the hover background — bends both of its ends upward. */}
                {index > 0 && <div className="h-px bg-border" />}
                <GlossaryListItem
                  glossary={glossary}
                  termCount={termCounts?.get(glossary.id) ?? 0}
                />
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </ConfigItem>
  )
}
