import { useAtomValue, useSetAtom } from "jotai";
import { useMemo } from "react";
import { diffConflictsResultAtom, resetResolutionAtom, resolutionsAtom, selectResolutionAtom, } from "@/utils/atoms/google-drive-sync";
export function useConflictField(pathKey) {
    const diffResult = useAtomValue(diffConflictsResultAtom);
    const resolutions = useAtomValue(resolutionsAtom);
    const selectResolution = useSetAtom(selectResolutionAtom);
    const resetResolution = useSetAtom(resetResolutionAtom);
    return useMemo(() => {
        const conflict = diffResult?.conflicts.find(c => c.path.join(".") === pathKey);
        return {
            conflict,
            resolution: resolutions[pathKey],
            selectLocal: () => selectResolution({ pathKey, resolution: "local" }),
            selectRemote: () => selectResolution({ pathKey, resolution: "remote" }),
            reset: () => resetResolution(pathKey),
        };
    }, [diffResult, resolutions, pathKey, selectResolution, resetResolution]);
}
