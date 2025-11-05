// src/components/Spinner.jsx
export default function Spinner({ text = "Loading...", className = "" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-4">
      <div className="relative">
        {/* Outer spinning ring */}
        <svg
          className={`animate-spin h-8 w-8 ${className || "text-blue-600"}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          ></path>
        </svg>
        {/* Inner pulsing dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
      </div>
      {text && (
        <span className="text-sm font-medium text-slate-700 animate-pulse">
          {text}
        </span>
      )}
    </div>
  );
}
