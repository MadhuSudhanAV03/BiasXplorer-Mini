import { useEffect } from "react";

/**
 * Toast notification component with animations
 * @param {string} type - success, error, warning, info
 * @param {string} message - Message to display
 * @param {boolean} visible - Whether toast is visible
 * @param {function} onClose - Callback when toast closes
 * @param {number} duration - Auto-close duration in ms (default 3000)
 */
export default function Toast({ 
  type = "info", 
  message, 
  visible, 
  onClose, 
  duration = 3000 
}) {
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible) return null;

  const styles = {
    success: {
      bg: "bg-gradient-to-r from-green-500 to-emerald-600",
      icon: "✅",
      border: "border-green-300",
    },
    error: {
      bg: "bg-gradient-to-r from-red-500 to-rose-600",
      icon: "❌",
      border: "border-red-300",
    },
    warning: {
      bg: "bg-gradient-to-r from-amber-500 to-orange-600",
      icon: "⚠️",
      border: "border-amber-300",
    },
    info: {
      bg: "bg-gradient-to-r from-blue-500 to-indigo-600",
      icon: "ℹ️",
      border: "border-blue-300",
    },
  };

  const style = styles[type] || styles.info;

  return (
    <div className="fixed top-4 right-4 z-[99999] animate-slideInRight">
      <div
        className={`${style.bg} ${style.border} border-2 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md animate-fadeInUp`}
      >
        <span className="text-2xl">{style.icon}</span>
        <span className="font-semibold flex-1">{message}</span>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors text-xl font-bold"
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
