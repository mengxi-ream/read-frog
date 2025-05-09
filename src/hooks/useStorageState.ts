import { useState, useEffect } from "react";

/**
 * Custom hook for syncing state with storage
 * @param key Storage key (without 'local:' prefix)
 * @param initialValue Initial value to use if nothing found in storage
 * @returns [value, setValue] tuple where setValue also updates storage
 */
export function useStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  // Load from storage and watch for changes
  useEffect(() => {
    let unwatch: (() => void) | undefined;

    const loadAndWatch = async () => {
      // Load initial value
      const storedValue = await storage.getItem<T>(`local:${key}`);
      if (storedValue !== null) setValue(storedValue);

      // Watch for changes
      unwatch = await storage.watch<T>(`local:${key}`, (newValue) => {
        if (newValue !== null) setValue(newValue);
      });
    };

    loadAndWatch();

    // Cleanup watcher
    return () => {
      unwatch?.();
    };
  }, []);

  // Function to update value in state and storage
  const updateValue = async (newValue: T) => {
    await storage.setItem<T>(`local:${key}`, newValue);
  };

  return [value, updateValue] as const;
}

/**
 * Custom hook that returns only the value from storage
 * @param key Storage key (without 'local:' prefix)
 * @param initialValue Initial value to use if nothing found in storage
 * @returns The current value from storage
 */
export function useStorageStateValue<T>(key: string, initialValue: T) {
  const [value] = useStorageState<T>(key, initialValue);
  return value;
}

/**
 * Custom hook that returns only the setter function for storage
 * @param key Storage key (without 'local:' prefix)
 * @param initialValue Initial value to use if nothing found in storage
 * @returns Function to update the value in storage
 */
export function useSetStorageState<T>(key: string, initialValue: T) {
  const [, setValue] = useStorageState<T>(key, initialValue);
  return setValue;
}
