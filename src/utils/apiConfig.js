export function getApiBase() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http')) {
      if (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173')) {
        return 'http://localhost:9999';
      }
      return origin;
    }
  }
  return 'http://128.1.1.10:9999';
}

export const API_BASE = getApiBase();

if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'API_BASE', {
      get() {
        return getApiBase();
      },
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    window.API_BASE = getApiBase();
  }
}
