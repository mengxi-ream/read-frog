export const storageAdapter = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const value = await storage.getItem<T>(`local:${key}`);
    return value ?? fallback;
  },
  async set<T>(key: string, value: T) {
    await storage.setItem(`local:${key}`, value);
  },
  watch<T>(key: string, callback: (newValue: T) => void) {
    const unwatch = storage.watch<T>(`local:${key}`, (newValue) => {
      if (newValue !== null) callback(newValue);
    });
    return unwatch;
  },
};
