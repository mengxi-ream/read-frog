/**
 * Return `baseName` if it is not in `existingNames`,
 * otherwise try `baseName{separator}1`, `baseName{separator}2`, … until a unique name is found.
 */
export function getUniqueName(baseName, existingNames, separator = " ") {
    if (!existingNames.has(baseName))
        return baseName;
    for (let i = 1;; i++) {
        const candidate = `${baseName}${separator}${i}`;
        if (!existingNames.has(candidate))
            return candidate;
    }
}
