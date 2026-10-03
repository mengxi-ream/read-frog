import type { CustomActionEditorTab } from "@/utils/navigation"
import { IconSettings, IconTable } from "@tabler/icons-react"
import { useSelector } from "@tanstack/react-store"
import { useAtom } from "jotai"
import { useMemo, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/base-ui/tabs"
import { i18n } from "@/utils/i18n"
import { CUSTOM_ACTION_NOTEBASE_SECTION_ID } from "@/utils/navigation"
import { sanitizeCustomActionNotebaseConnection } from "@/utils/notebase/connection"
import { cn } from "@/utils/styles/utils"
import { customActionEditorTabAtom } from "../atoms"
import { useActionEditor } from "./action-editor"

type TabsKey = "config" | "notebase" | "hasErrors" | "connected" | "needsAttention"

function t(key: TabsKey) {
  return i18n.t(`options.selectionToolbar.customActions.tabs.${key}`)
}

// Clears the narrow-width sticky top bar (h-12) when a tab or the bar is scrolled to.
const SCROLL_MARGIN = "scroll-mt-14 md:scroll-mt-4"

function StatusDot({ tone, label }: { tone: "neutral" | "destructive"; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        tone === "destructive" ? "bg-destructive" : "bg-muted-foreground/70",
      )}
    />
  )
}

function ConfigTabStatus() {
  const { form } = useActionEditor().state
  // Mapping problems belong to the Notebase tab's own dot.
  const hasErrors = useSelector(form.store, (state) =>
    Object.entries(state.fieldMeta).some(
      ([name, meta]) => !name.startsWith("notebaseConnection") && (meta?.errors.length ?? 0) > 0,
    ),
  )
  return hasErrors ? <StatusDot tone="destructive" label={t("hasErrors")} /> : null
}

function NotebaseTabStatus() {
  const { form } = useActionEditor().state
  const outputSchema = useSelector(form.store, (state) => state.values.outputSchema)
  const connection = useSelector(form.store, (state) => state.values.notebaseConnection)
  const sanitized = useMemo(
    () => sanitizeCustomActionNotebaseConnection(connection, outputSchema),
    [connection, outputSchema],
  )

  // A connection the sanitizer rejects outright reads as "not connected" in the tab too.
  if (!connection || !sanitized) return null
  // Dropped mappings point at a deleted field or collide with another; saving would skip them.
  if (sanitized.mappings.length < connection.mappings.length) {
    return <StatusDot tone="destructive" label={t("needsAttention")} />
  }
  return <StatusDot tone="neutral" label={t("connected")} />
}

/**
 * Config | Notebase. Both panels stay mounted, so the form keeps one set of field instances and one
 * autosave session, and editor state such as undo history survives a tab switch.
 */
export function ActionEditorTabs({
  config,
  notebase,
}: {
  config: React.ReactNode
  notebase: React.ReactNode
}) {
  const [tab, setTab] = useAtom(customActionEditorTabAtom)
  const tabBarRef = useRef<HTMLDivElement>(null)

  const handleValueChange = (value: CustomActionEditorTab) => {
    setTab(value)
    // After a switch from far down a tall panel, bring the bar back so the new panel shows its top.
    requestAnimationFrame(() => {
      const bar = tabBarRef.current
      if (!bar) return
      const clearance = Number.parseFloat(getComputedStyle(bar).scrollMarginTop) || 0
      if (bar.getBoundingClientRect().top < clearance) {
        bar.scrollIntoView({ block: "start" })
      }
    })
  }

  return (
    <Tabs value={tab} onValueChange={handleValueChange} className="gap-4">
      {/* Flush with the card's top and sides, so the hairline runs edge to edge; the
          list's px-1 and a tab's px-3 line the first label up with the fields below. */}
      <div ref={tabBarRef} className={cn("-mx-4 -mt-4", SCROLL_MARGIN)}>
        <TabsList variant="line" className="w-full px-1">
          <TabsTrigger value="config">
            <IconSettings />
            {t("config")}
            <ConfigTabStatus />
          </TabsTrigger>
          <TabsTrigger
            id={CUSTOM_ACTION_NOTEBASE_SECTION_ID}
            value="notebase"
            className={SCROLL_MARGIN}
          >
            <IconTable />
            {t("notebase")}
            <NotebaseTabStatus />
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="config" keepMounted>
        {config}
      </TabsContent>
      <TabsContent value="notebase" keepMounted>
        {notebase}
      </TabsContent>
    </Tabs>
  )
}
