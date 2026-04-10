export function buildLocalStorageKey(base: string, ...segments: string[]): string {
  return [base, ...segments.filter(Boolean)].join(':');
}

export function readFirstLocalStorageValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  }

  return null;
}
