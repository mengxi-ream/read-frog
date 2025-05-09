import { atom, createStore } from "jotai";
import { DEFAULT_SIDE_CONTENT_WIDTH } from "../../utils/constants/side";

export const store = createStore();

export const isSideOpenAtom = atom(false);
export const sideContentWidthAtom = atom(DEFAULT_SIDE_CONTENT_WIDTH);

export const progressAtom = atom({
  completed: 0,
  total: 0,
});

// export const explainAtom = atomWithMutation(() => ({
//   mutationKey: ["explainArticle"],
//   mutationFn: mutationFn,
// }));

export const readStateAtom = atom<
  "analyzing" | "continue?" | "explaining" | undefined
>(undefined);
