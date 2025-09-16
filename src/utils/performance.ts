/**
 * Performance utility functions for optimizing React applications
 */

/**
 * Creates a debounced version of a function that delays execution until after
 * a specified delay period has passed since the last invocation.
 *
 * @param func The function to debounce
 * @param delay The delay in milliseconds
 * @returns The debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Creates a throttled version of a function that limits execution to at most
 * once per specified time period.
 *
 * @param func The function to throttle
 * @param limit The time limit in milliseconds
 * @returns The throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Safely parses JSON with error handling
 *
 * @param json The JSON string to parse
 * @param fallback The fallback value if parsing fails
 * @returns The parsed value or fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback;
  }
}

/**
 * Validates that an object has the expected structure
 *
 * @param obj The object to validate
 * @param requiredKeys Array of required keys
 * @returns Whether the object is valid
 */
export function validateObjectStructure(
  obj: any,
  requiredKeys: string[]
): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  return requiredKeys.every(key => key in obj);
}

/**
 * Safely saves to localStorage with quota exceeded handling
 *
 * @param key The localStorage key
 * @param data The data to save
 * @returns Whether the save was successful
 */
export function safeLocalStorageSave(key: string, data: any): boolean {
  try {
    const serialized = JSON.stringify(data);

    // Check if the data is too large (localStorage typically has a 5-10MB limit)
    if (serialized.length > 5 * 1024 * 1024) {
      console.warn('Data too large for localStorage, attempting compression...');
      // In production, you might want to implement compression here
      return false;
    }

    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    if (error instanceof DOMException && (
      error.code === 22 ||
      error.code === 1014 ||
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.error('localStorage quota exceeded');
      // Try to clear old data or notify user
      return false;
    }
    console.error('localStorage save error:', error);
    return false;
  }
}

/**
 * Memoization helper for expensive calculations
 *
 * @param fn The function to memoize
 * @param getKey Function to generate cache key from arguments
 * @returns Memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);

    // Limit cache size to prevent memory leaks
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  }) as T;
}