// In-memory shim for @react-native-async-storage/async-storage so any
// module that imports it can load under Vitest. Unit tests that exercise
// pure logic don't touch storage at all; integration-style tests can
// reset() between cases.

const store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  async setItem(key: string, value: string) {
    store.set(key, value);
  },
  async removeItem(key: string) {
    store.delete(key);
  },
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return keys.map((k) => [k, store.has(k) ? store.get(k)! : null]);
  },
  async multiSet(pairs: [string, string][]) {
    for (const [k, v] of pairs) store.set(k, v);
  },
  async multiRemove(keys: string[]) {
    for (const k of keys) store.delete(k);
  },
  async clear() {
    store.clear();
  },
};

export default AsyncStorage;
