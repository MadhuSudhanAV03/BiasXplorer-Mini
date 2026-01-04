import { useState, useCallback } from "react";

/**
 * Custom hook for toast notifications
 * @returns {Object} Toast state and functions
 */
export function useToast() {
  const [toast, setToast] = useState({
    visible: false,
    type: "info",
    message: "",
  });

  const showToast = useCallback((type, message, duration = 3000) => {
    setToast({ visible: true, type, message });
    if (duration > 0) {
      setTimeout(() => {
        setToast((t) => ({ ...t, visible: false }));
      }, duration);
    }
  }, []);

  const hideToast = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  const success = useCallback((message, duration) => {
    showToast("success", message, duration);
  }, [showToast]);

  const error = useCallback((message, duration) => {
    showToast("error", message, duration);
  }, [showToast]);

  const warning = useCallback((message, duration) => {
    showToast("warning", message, duration);
  }, [showToast]);

  const info = useCallback((message, duration) => {
    showToast("info", message, duration);
  }, [showToast]);

  return {
    toast,
    showToast,
    hideToast,
    success,
    error,
    warning,
    info,
  };
}
