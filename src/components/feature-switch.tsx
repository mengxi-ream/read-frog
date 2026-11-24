import type { ComponentProps } from "react"
import type { FeatureId } from "@/utils/features"
import { useAtomValue, useSetAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configAtom, writeConfigAtom } from "@/utils/atoms/config"
import { isFeatureOn, isFeatureSwitchOn, parentOf, setFeatureOn } from "@/utils/features"

type FeatureSwitchProps = { id: FeatureId } & Omit<
  ComponentProps<typeof Switch>,
  "id" | "checked" | "defaultChecked" | "disabled" | "onCheckedChange"
>

/**
 * A simple mode feature's own switch. It shows the feature's switch, not whether the feature
 * runs: under a parent that is off it keeps its position and is disabled, and the parent coming
 * back on brings it back as it was.
 */
export function FeatureSwitch({ id, ...props }: FeatureSwitchProps) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const parent = parentOf(id)

  return (
    <Switch
      {...props}
      checked={isFeatureSwitchOn(config, id)}
      disabled={parent !== undefined && !isFeatureOn(config, parent)}
      onCheckedChange={(on) => void setConfig(setFeatureOn(id, on))}
    />
  )
}
