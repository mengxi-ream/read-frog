import type { FeatureId } from "@/utils/features"
import { useAtomValue } from "jotai"
import { featureOnAtom } from "@/utils/atoms/features"

/** Whether a simple mode feature is on: its own switch and every one above it. */
export function useFeatureOn(id: FeatureId): boolean {
  return useAtomValue(featureOnAtom(id))
}
