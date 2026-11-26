import type { FeatureId } from "@/utils/features"
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { isFeatureOn } from "@/utils/features"
import { configAtom } from "./config"

/** `isFeatureOn` as an atom, so a reader re-renders only when the feature turns on or off. */
export const featureOnAtom = atomFamily((id: FeatureId) =>
  atom((get) => isFeatureOn(get(configAtom), id)),
)
