import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";
import Toast from "./Toast";

const SET_TYPES_URL = "http://localhost:5000/api/column-types";

export default function ColumnSelector({
  filePath,
  columns = [],
  onSubmit,
  onPrevious,
  initialSelections = {},
}) {
  const [selections, setSelections] = useState(() => {
    const init = {};
    (columns || []).forEach((c) => (init[c] = initialSelections[c] || null));
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });
  const [error, setError] = useState("");

  // Update state when columns prop changes
  // Note: if parent re-renders with different columns, reset selections accordingly
  // eslint-disable-next-line react/prop-types
  const resetSelections = (cols) => {
    const init = {};
    (cols || []).forEach((c) => (init[c] = null));
    setSelections(init);
  };

  // Derive arrays for submission
  const { categorical, continuous } = useMemo(() => {
    const cat = [];
    const cont = [];
    Object.entries(selections).forEach(([col, type]) => {
      if (type === "categorical") cat.push(col);
      if (type === "continuous") cont.push(col);
    });
    return { categorical: cat, continuous: cont };
  }, [selections]);

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const toggle = (col, type) => {
    setSelections((prev) => {
      const current = prev[col];
      const next = { ...prev };
      if (type === "categorical") {
        next[col] = current === "categorical" ? null : "categorical";
      } else if (type === "continuous") {
        next[col] = current === "continuous" ? null : "continuous";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setError("");
    if (!filePath) {
      setError("No file selected. Please upload a dataset first.");
      return;
    }
    try {
      setSubmitting(true);
      const payload = { file_path: filePath, categorical, continuous };
      const res = await axios.post(SET_TYPES_URL, payload, {
        headers: { "Content-Type": "application/json" },
      });
      showToast("success", "Column types saved.");
      onSubmit?.({ categorical, continuous, response: res.data });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        "Failed to save column types";
      setError(msg);
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔤</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              Classify Column Types
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Select whether each column is categorical or continuous
            </p>
          </div>
        </div>
        <div className="px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl border border-blue-200">
          <div className="text-xs font-semibold text-blue-900">
            📁 {filePath?.split("/").pop() || filePath || "(none)"}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 p-4 text-red-800 border-2 border-red-200 shadow-lg flex items-center gap-3 animate-slideInLeft">
          <span className="text-2xl">❌</span>
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 shadow-xl">
        <table className="min-w-full table-auto">
          <thead className="bg-gradient-to-r from-slate-100 to-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-slate-700 border-b-2 border-slate-300">
                Column Name
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider text-slate-700 border-b-2 border-slate-300">
                📊 Categorical
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider text-slate-700 border-b-2 border-slate-300">
                📈 Continuous
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {(columns || []).map((col, idx) => (
              <tr
                key={col}
                className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 animate-fadeInUp stagger-${Math.min(
                  (idx % 6) + 1,
                  6
                )}`}
              >
                <td className="px-6 py-4 text-sm font-semibold text-slate-800 whitespace-nowrap">
                  {col}
                </td>
                <td className="px-6 py-4 text-center">
                  <label className="inline-flex items-center justify-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500 cursor-pointer"
                      checked={selections[col] === "categorical"}
                      onChange={() => toggle(col, "categorical")}
                    />
                    <span
                      className={`font-medium transition-colors ${
                        selections[col] === "categorical"
                          ? "text-amber-700"
                          : "text-slate-500 group-hover:text-amber-600"
                      }`}
                    >
                      {selections[col] === "categorical" && "✓"}
                    </span>
                  </label>
                </td>
                <td className="px-6 py-4 text-center">
                  <label className="inline-flex items-center justify-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      checked={selections[col] === "continuous"}
                      onChange={() => toggle(col, "continuous")}
                    />
                    <span
                      className={`font-medium transition-colors ${
                        selections[col] === "continuous"
                          ? "text-blue-700"
                          : "text-slate-500 group-hover:text-blue-600"
                      }`}
                    >
                      {selections[col] === "continuous" && "✓"}
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
        {onPrevious ? (
          <button
            type="button"
            onClick={onPrevious}
            className="group px-6 py-3 text-sm font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift flex items-center gap-2"
          >
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>
            <span>Previous</span>
          </button>
        ) : (
          <div className="flex items-center gap-4 text-sm font-semibold">
            <div className="px-4 py-2 bg-amber-100 text-amber-800 rounded-xl">
              📊 Categorical: {categorical.length}
            </div>
            <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl">
              📈 Continuous: {continuous.length}
            </div>
          </div>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-white font-bold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift"
          onClick={handleSubmit}
          disabled={submitting || !filePath}
        >
          {submitting ? (
            <>
              <span>⏳</span>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>Save & Continue</span>
            </>
          )}
        </button>
      </div>

      {/* Toast Notification */}
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </div>
  );
}
