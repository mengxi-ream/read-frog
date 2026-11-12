import type { SelectionToolbarItem } from "@/utils/selection-toolbar-items"
import { Icon } from "@iconify/react"
import { RiTranslate } from "@remixicon/react"
import { IconDotsVertical, IconVolume, IconX } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ANNOTATION_ICON } from "@/utils/iconify/bundled-icons"
import { getSelectionToolbarItems } from "@/utils/selection-toolbar-items"
import {
  PREVIEW_SELECTION_CLASS_NAME,
  PreviewBackdrop,
  PreviewBrowserWindow,
  PreviewPointer,
  PreviewStage,
  PreviewTextLines,
} from "../../components/feature-preview"

// The toolbar's own classes (content-runtime/selection/selection-toolbar), less the interaction states.
const BUTTON_CLASS_NAME = "relative flex h-7 shrink-0 items-center justify-center px-2"
const SEPARATOR_CLASS_NAME = "w-px shrink-0 self-stretch bg-border"

function PinnedItemIcon({ item }: { item: SelectionToolbarItem }) {
  if (item.kind === "action") {
    return <Icon icon={item.action.icon} strokeWidth={0.8} className="size-4.5" />
  }
  return item.id === "translate" ? (
    <RiTranslate className="size-4.5" />
  ) : (
    <IconVolume className="size-4.5" strokeWidth={1.6} />
  )
}

/**
 * The toolbar as the settings make it — the annotation button, the pinned items in their order,
 * and the "more" menu, at the chosen opacity — over a selection on a web page, with the pointer on
 * it so its close button shows.
 */
export function SelectionToolbarPreview() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const pinnedItems = getSelectionToolbarItems(selectionToolbar).filter(
    (item) => item.enabled && item.pinned,
  )

  return (
    <PreviewBackdrop role="img" aria-label={i18n.t("options.selectionToolbar.demoImageAlt")}>
      <PreviewStage>
        <PreviewBrowserWindow className="inset-x-[90px] top-[38px]">
          <div className="px-8 pt-[22px]">
            <div className="mb-3 text-xl font-semibold tracking-[-0.01em] text-neutral-950 dark:text-neutral-100">
              The quiet craft of Mr. Kamiya
            </div>
            <div className="text-[15px] leading-[26px] whitespace-nowrap">
              <div>Mr. Kamiya is not fighting against the world, but</div>
              <div>
                against things that could make the world{" "}
                <span className={PREVIEW_SELECTION_CLASS_NAME}>
                  take notice
                  <span className="absolute bottom-[calc(100%+7px)] left-1/2 -translate-x-1/2">
                    <span
                      className="relative block [zoom:1.2] text-foreground"
                      style={{ opacity: selectionToolbar.opacity / 100 }}
                    >
                      <span className="absolute inset-0 rounded-lg border border-border/50 bg-popover shadow-md" />
                      <span className="relative flex items-center">
                        {selectionToolbar.annotation.enabled && (
                          <>
                            <span className={BUTTON_CLASS_NAME}>
                              <Icon icon={ANNOTATION_ICON} className="size-4.5" />
                            </span>
                            <span className={SEPARATOR_CLASS_NAME} />
                          </>
                        )}
                        {/* `clip` rather than `hidden`: it clips the row at the toolbar's width
                            without clipping the pointer that hangs below it. */}
                        <span className="flex max-w-105 items-center overflow-x-clip">
                          {pinnedItems.map((item, index) => (
                            <span key={item.id} className={BUTTON_CLASS_NAME}>
                              <PinnedItemIcon item={item} />
                              {index === 0 && <PreviewPointer className="top-3.5 left-3" />}
                            </span>
                          ))}
                        </span>
                        {pinnedItems.length > 0 && <span className={SEPARATOR_CLASS_NAME} />}
                        <span className="flex h-7 shrink-0 items-center justify-center px-1">
                          <IconDotsVertical className="size-4" strokeWidth={1.6} />
                        </span>
                      </span>
                      <span className="absolute -top-1 -right-1 rounded-full border border-border bg-neutral-100 dark:bg-neutral-900">
                        <IconX className="h-3 w-3 text-neutral-400 dark:text-neutral-600" />
                      </span>
                    </span>
                  </span>
                </span>
                .
              </div>
              <div>He keeps a notebook of small failures, and reads</div>
              <div>it every morning before the shop opens.</div>
            </div>
            <PreviewTextLines widths={[94, 88, 70]} className="pt-[18px]" />
          </div>
        </PreviewBrowserWindow>
      </PreviewStage>
    </PreviewBackdrop>
  )
}
