import { useState, useEffect } from "react";

export function usePersistedState(key, defaultValue) {
  // Initialize state from localStorage or default value
  const [state, setState] = useState(() => {
    const persistedValue = localStorage.getItem(key);
    return persistedValue !== null ? JSON.parse(persistedValue) : defaultValue;
  });

  // Update localStorage when state changes
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
