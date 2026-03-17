export function pick<
  T extends object,
  K extends readonly (keyof T)[],
>(obj: T, keys: K): { [I in K[number]]: T[I] } {
  const res = {} as { [I in K[number]]: T[I] }
  for (const key of keys) {
    if (key in obj) {
      res[key] = obj[key]
    }
  }
  return res
}

export function omit<
  T extends object,
  K extends readonly (keyof T)[],
>(obj: T, keys: K): Omit<T, K[number]> {
  const res = { ...obj } as T
  for (const key of keys) {
    delete (res as any)[key]
  }
  return res as Omit<T, K[number]>
}

/**
 * Remove entries with empty string, null, or undefined values from an object.
 */
export function compactObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v != null),
  ) as Partial<T>
}
