export interface CleanUndefinedOptions {
  preserve?: (value: unknown) => boolean;
}

export function cleanUndefinedDeep(value: unknown, options: CleanUndefinedOptions = {}): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (options.preserve?.(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => cleanUndefinedDeep(item, options));
  }

  if (typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) {
        cleaned[key] = cleanUndefinedDeep(nested, options);
      }
    }
    return cleaned;
  }

  return value;
}
