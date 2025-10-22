import { atom } from 'jotai'

const DEFAULT_RECENT_DAY = '5'

export const recentDayAtom = atom<string>(DEFAULT_RECENT_DAY)
