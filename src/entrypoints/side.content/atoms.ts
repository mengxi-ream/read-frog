import { atom, createStore } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const store = createStore()

export const isSideOpenAtom = atomWithStorage('isSideOpenAtom', false)

export const progressAtom = atom({
  completed: 0,
  total: 0,
})

// Translation port atom for browser.runtime.connect
export const translationPortAtom = atom<Browser.runtime.Port | null>(null)
export const enablePageTranslationAtom = atom(false)

// export const explainAtom = atomWithMutation(() => ({
//   mutationKey: ["explainArticle"],
//   mutationFn: mutationFn,
// }));

export const readStateAtom = atom<
  'extracting' | 'analyzing' | 'continue?' | 'explaining' | undefined
>(undefined)
