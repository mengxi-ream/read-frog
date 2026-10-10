import { i18n } from "@/utils/i18n"

/** Under a shortcut whose feature is switched off: the key is kept but does nothing for now. */
export function TurnedOffNote() {
  return <span className="mt-1 block">{i18n.t("options.shortcuts.turnedOff")}</span>
}
