import { atom } from "jotai";
import { storageAdapter } from "./storage-adapter";
import deepmerge from "deepmerge";
import { selectAtom } from "jotai/utils";
import { Config } from "@/types/config/config";
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "../constants/config";

export const configAtom = atom<Config>(DEFAULT_CONFIG);

export const writeConfigAtom = atom(
  null,
  async (get, set, patch: Partial<Config>) => {
    // ! If we don't use HydrateAtoms, there will be a bug that every time refresh the page, the config will be reset to default
    // ! because we call this function when the page is loaded by extractContent useQuery, that time, configAtom is DEFAULT_CONFIG and the next will be deepmerge(DEFAULT_CONFIG, patch)
    const next = deepmerge(get(configAtom), patch);
    set(configAtom, next); // UI 乐观更新，这会让 react 多一次渲染，因为 react 渲染只有浅比较，前后两个 object 值一样会触发两次渲染
    await storageAdapter.set(CONFIG_STORAGE_KEY, next); // 成功后会调用 onMount 的 callback，设置真正的值，第二次渲染
  }
);

configAtom.onMount = (setAtom: (newValue: Config) => void) => {
  storageAdapter.get<Config>(CONFIG_STORAGE_KEY, DEFAULT_CONFIG).then(setAtom);
  const unwatch = storageAdapter.watch<Config>(CONFIG_STORAGE_KEY, setAtom);
  return unwatch;
};

// export const configFieldAtom = <K extends Keys>(key: K) => {
//   const readAtom = selectAtom(configAtom, (c) => c[key]); // 现在是同步
//   const writeAtom = atom(null, (_get, set, val: Config[K]) =>
//     set(writeConfigAtom, { [key]: val })
//   );
//   return [readAtom, writeAtom] as const;
// };

type Keys = keyof Config;

export const getConfigFieldAtom = <K extends Keys>(key: K) => {
  // 如果不介意"改别的字段也重渲"，可以直接 get(configAtom)[key] 而不使用 selectAtom。
  const sliceAtom = selectAtom(configAtom, (c) => c[key]);

  return atom(
    (get) => get(sliceAtom),
    (_get, set, newVal: Partial<Config[K]>) =>
      set(writeConfigAtom, { [key]: newVal })
  );
};

function buildConfigFields<C extends Config>(cfg: C) {
  type ValidKey = Extract<keyof C, keyof Config>;
  type Map = { [K in ValidKey]: ReturnType<typeof getConfigFieldAtom<K>> };

  const res = {} as Map;

  const add = <K extends ValidKey>(key: K) => {
    res[key] = getConfigFieldAtom(key);
  };

  (Object.keys(cfg) as ValidKey[]).forEach(add);
  return res;
}

export const configFields = buildConfigFields(DEFAULT_CONFIG);
