/**
 * Confirmation dialog component to replace window.confirm
 * @param {boolean} isOpen - Whether dialog is visible
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @param {function} onConfirm - Callback when confirmed
 * @param {function} onCancel - Callback when cancelled
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} type - Dialog type: warning, danger, info (default: "warning")
 */
export default function ConfirmDialog({
  isOpen,
  title = "Confirm Action",
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
}) {
  if (!isOpen) return null;

  const styles = {
    warning: {
      icon: "⚠️",
      bg: "from-amber-50 to-orange-50",
      border: "border-amber-300",
      confirmBg: "from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700",
    },
    danger: {
      icon: "🚨",
      bg: "from-red-50 to-rose-50",
      border: "border-red-300",
      confirmBg: "from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700",
    },
    info: {
      icon: "ℹ️",
      bg: "from-blue-50 to-indigo-50",
      border: "border-blue-300",
      confirmBg: "from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
    },
  };

  const style = styles[type] || styles.warning;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[99999]"
      style={{ 
        zIndex: 99999,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(255, 255, 255, 0.3)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel?.();
        }
      }}
    >
      <div 
        className={`bg-gradient-to-br ${style.bg} rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-scaleIn`}
        onClick={(e) => e.stopPropagation()}
        style={{
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none'
        }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{style.icon}</span>
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-gray-700 text-base leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white/50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onCancel}
            type="button"
            className="px-6 py-3 text-sm font-bold text-gray-700 bg-white hover:bg-gray-100 rounded-lg transition-all border-2 border-gray-300 hover:border-gray-400 shadow-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            type="button"
            className={`px-6 py-3 text-sm font-bold text-white bg-gradient-to-r ${style.confirmBg} rounded-lg transition-all shadow-lg hover:shadow-xl`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
