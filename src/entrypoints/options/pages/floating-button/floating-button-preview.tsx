import { RiTranslate } from "@remixicon/react"
import {
  IconCheck,
  IconLock,
  IconLockOpen,
  IconMessageCircle,
  IconSettings,
  IconX,
} from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import readFrogLogo from "@/assets/icons/read-frog.png"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import {
  PreviewBackdrop,
  PreviewBrowserWindow,
  PreviewStage,
  PreviewTextLines,
} from "../../components/feature-preview"

// The classes below are the floating button's own (content-runtime/side/components/floating-button),
// less the interaction states, drawn expanded as when the pointer is on it.
const HIDDEN_BUTTON_CLASS_NAME =
  "relative rounded-full border border-border bg-white p-1.5 text-neutral-600 shadow-lg dark:bg-neutral-900 dark:text-neutral-400"
const CONTROL_CLASS_NAME =
  "absolute flex size-6 items-center justify-center text-neutral-300 dark:text-neutral-700"

/** A web page with the floating button on it, on the side the settings put it. */
export function FloatingButtonPreview() {
  const { side, locked } = useAtomValue(configFieldsAtomMap.floatingButton)
  const onRight = side === "right"
  const hiddenButtonClassName = cn(HIDDEN_BUTTON_CLASS_NAME, onRight ? "mr-2" : "ml-2")
  const controlClassName = cn(CONTROL_CLASS_NAME, onRight ? "-left-6" : "-right-6")
  const LockIcon = locked ? IconLock : IconLockOpen

  return (
    <PreviewBackdrop role="img" aria-label={i18n.t("options.floatingButton.demoImageAlt")}>
      <PreviewStage>
        <PreviewBrowserWindow className="inset-x-[90px] top-[38px]">
          <div className={cn("flex flex-col pt-[26px]", onRight ? "pr-30 pl-8" : "pr-8 pl-30")}>
            <span className="mb-[17px] h-[13px] w-[46%] rounded-[5px] bg-[#e9e9e9] dark:bg-[#333]" />
            <PreviewTextLines widths={[92, 96, 84, 62]} />
            <PreviewTextLines widths={[94, 88, 70]} className="mt-[30px]" />
          </div>
          <div
            className={cn(
              "absolute top-[22px] flex [zoom:1.2] flex-col gap-2",
              onRight ? "right-0 items-end" : "left-0 items-start",
            )}
          >
            <span className={hiddenButtonClassName}>
              <RiTranslate className="h-5 w-5" />
              <IconCheck className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-success text-white" />
            </span>
            <div className="relative">
              <div
                className={cn(
                  "relative flex h-10 w-11 items-center border border-border bg-white shadow-lg dark:bg-neutral-900",
                  onRight
                    ? "justify-start rounded-l-full border-r-0"
                    : "justify-end rounded-r-full border-l-0",
                )}
              >
                <img
                  src={readFrogLogo}
                  alt=""
                  className={cn("h-8 w-8 rounded-full", onRight ? "ml-1" : "mr-1")}
                />
              </div>
              <span className={cn(controlClassName, "-top-1")}>
                <IconX className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className={cn(controlClassName, "-bottom-1")}>
                <LockIcon className="h-3 w-3" strokeWidth={3} />
              </span>
            </div>
            <span className={hiddenButtonClassName}>
              <IconSettings className="h-5 w-5" />
            </span>
            <span className={hiddenButtonClassName}>
              <IconMessageCircle className="h-5 w-5" />
            </span>
          </div>
        </PreviewBrowserWindow>
      </PreviewStage>
    </PreviewBackdrop>
  )
}
