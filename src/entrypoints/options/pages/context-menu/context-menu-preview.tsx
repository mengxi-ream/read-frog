import { IconChevronRight } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { browser } from "#imports"
import readFrogLogo from "@/assets/icons/read-frog.png"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getSelectionContextMenuItems } from "@/utils/context-menu"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import {
  PREVIEW_SELECTION_CLASS_NAME,
  PreviewBackdrop,
  PreviewBrowserWindow,
  PreviewPointer,
  PreviewStage,
  PreviewTextLines,
} from "../../components/feature-preview"

const SAMPLE_SELECTION = "Mr. Kamiya"

// The menu itself is the browser's and looks different on every platform; this is a neutral one.
const MENU_CLASS_NAME = cn(
  "rounded-[9px] bg-white p-[5px] whitespace-nowrap",
  "shadow-[0_0_0_0.5px_rgb(0_0_0/0.2),0_12px_32px_-8px_rgb(20_28_12/0.32)]",
  "dark:bg-[#2a2a2a] dark:shadow-[0_0_0_0.5px_rgb(255_255_255/0.16),0_12px_32px_-8px_rgb(0_0_0/0.65)]",
)
const ITEM_CLASS_NAME = "relative flex h-[22px] items-center rounded-[5px] pr-3 pl-7"
const HIGHLIGHTED_ITEM_CLASS_NAME = "bg-black/7 dark:bg-white/10"

// The stage (`PreviewStage`, 330px) holds five rows of Read Frog's submenu, the default list:
// translate, read aloud and the three built-in actions. Each row past those, 22px like every item,
// makes it that much taller, so a long list of actions is never cut off at the bottom.
const STAGE_HEIGHT = 330
const ROWS_IN_STAGE = 5
const ROW_HEIGHT = 22

function MenuSeparator() {
  return <span className="mx-2.5 my-[5px] block h-px bg-black/10 dark:bg-white/12" />
}

/** One of the browser's own items, which aren't ours to name: a bar instead of its label. */
function BrowserMenuItem({ className }: { className: string }) {
  return (
    <span className={ITEM_CLASS_NAME}>
      <span className={cn("h-2 rounded-full bg-black/10 dark:bg-white/15", className)} />
    </span>
  )
}

/**
 * Right-clicking a selection on a web page. With more than one item to add, the browser gathers an
 * extension's items into a submenu under its name, so that's where Read Frog's are: the same list
 * the background puts there, actions included.
 */
export function ContextMenuPreview() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const items = getSelectionContextMenuItems(selectionToolbar)
  // The browser names the submenu after the extension in the browser's language, which needn't be
  // the one Read Frog's settings are in. WXT types `getMessage` for the predefined messages only.
  const extensionName = (browser.i18n.getMessage as (messageName: string) => string)("extName")

  return (
    <PreviewBackdrop role="img" aria-label={i18n.t("options.contextMenu.demoImageAlt")}>
      <PreviewStage
        style={{
          height: STAGE_HEIGHT + Math.max(0, items.length - ROWS_IN_STAGE) * ROW_HEIGHT,
        }}
      >
        {/* Left of centre, so the menus that run out of the window have room. Drawn at the page's
            scale and with their labels capped, they stay on the stage, which is all a narrow
            settings page shows: in every language, but for a few pixels of padding when an
            action's name reaches the cap in the longest one. */}
        <PreviewBrowserWindow className="top-[38px] right-[165px] left-[15px] overflow-visible">
          <div className="px-8 pt-3.5">
            <div className="text-[15px] leading-[26px] whitespace-nowrap">
              <div>
                <span className={PREVIEW_SELECTION_CLASS_NAME}>
                  {SAMPLE_SELECTION}
                  <span className="absolute top-[calc(100%+2px)] left-[calc(100%-4px)] flex items-start text-[13px] leading-[22px] text-[#1d1d1f] dark:text-neutral-100">
                    <span className={MENU_CLASS_NAME}>
                      <BrowserMenuItem className="w-10" />
                      <BrowserMenuItem className="w-32" />
                      <MenuSeparator />
                      <span className={cn(ITEM_CLASS_NAME, HIGHLIGHTED_ITEM_CLASS_NAME)}>
                        <img
                          src={readFrogLogo}
                          alt=""
                          className="absolute top-[3px] left-[7px] size-4"
                        />
                        <span className="max-w-72 truncate">{extensionName}</span>
                        <IconChevronRight className="ml-auto box-content size-3 pl-[22px]" />
                      </span>
                      <MenuSeparator />
                      <BrowserMenuItem className="w-14" />
                    </span>
                    {/* Its first item level with the item it opens from: 5px of padding, two
                        items and a separator above that one. */}
                    <span className={cn(MENU_CLASS_NAME, "mt-[55px] -ml-[3px]")}>
                      {items.map((item, index) => (
                        <span
                          key={item.id}
                          className={cn(
                            ITEM_CLASS_NAME,
                            index === 0 && HIGHLIGHTED_ITEM_CLASS_NAME,
                          )}
                        >
                          <span className="max-w-52 truncate">
                            {item.title.replaceAll("%s", SAMPLE_SELECTION)}
                          </span>
                          {index === 0 && <PreviewPointer className="top-2.5 right-6" />}
                        </span>
                      ))}
                    </span>
                  </span>
                </span>{" "}
                is not fighting against the world, but
              </div>
              <div>against things that could make the world take notice.</div>
              <div>He keeps a notebook of small failures, and reads</div>
              <div>it every morning before the shop opens.</div>
            </div>
            <PreviewTextLines widths={[94, 88, 70, 84, 56]} className="pt-[18px]" />
          </div>
        </PreviewBrowserWindow>
      </PreviewStage>
    </PreviewBackdrop>
  )
}
