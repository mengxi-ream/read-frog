import type { ClassValue } from "clsx"
import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const mergeTailwindClasses = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["floating"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return mergeTailwindClasses(clsx(inputs))
}
