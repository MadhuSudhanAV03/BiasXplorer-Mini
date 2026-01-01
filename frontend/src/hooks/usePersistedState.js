import { useState, useEffect } from "react";

export function usePersistedState(key, defaultValue) {
  // Initialize state from localStorage or default value
  const [state, setState] = useState(() => {
    try {
      const persistedValue = localStorage.getItem(key);
      if (persistedValue === null || persistedValue === "undefined") {
        return defaultValue;
      }
      return JSON.parse(persistedValue);
    } catch (error) {
      console.warn(`Failed to parse localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to save to localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
}
