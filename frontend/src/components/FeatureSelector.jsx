import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";
import Toast from "./Toast";

const SELECT_URL = "http://localhost:5000/api/features";

export default function FeatureSelector({
  filePath,
  columns = [],
  onSelect,
  onPrevious,
  initialSelected = [],
}) {
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
  };

  const toggle = (col) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(columns));
  const clearAll = () => setSelected(new Set());

  const selectedList = useMemo(() => Array.from(selected), [selected]);

  const handleSubmit = async () => {
    setError("");
    if (!filePath) {
      const msg = "No file selected. Please upload a dataset first.";
      setError(msg);
      showToast("error", msg);
      return;
    }
    if (selected.size === 0) {
      const msg = "Please select at least one feature.";
      setError(msg);
      showToast("error", msg);
      return;
    }
    try {
      setSubmitting(true);
      const payload = { file_path: filePath, selected_features: selectedList };
      const res = await axios.post(SELECT_URL, payload, {
        headers: { "Content-Type": "application/json" },
      });
      showToast("success", "Features selected successfully.");
      onSelect?.({ features: selectedList, response: res.data });
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        "Failed to select features";
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
          <div className="text-4xl">🎯</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              Target Column Selection
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Choose which columns to include in your analysis
            </p>
          </div>
        </div>
        <div className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl border border-purple-200">
          <div className="text-xs font-semibold text-purple-900">
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

      <div className="mb-6 flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={selectAll}
            disabled={!columns.length}
          >
            <span>☑️</span>
            <span>Select All</span>
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-bold text-slate-700 bg-gradient-to-r from-slate-200 to-slate-300 hover:from-slate-300 hover:to-slate-400 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={clearAll}
            disabled={!columns.length}
          >
            <span>✖️</span>
            <span>Clear All</span>
          </button>
        </div>
        <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl shadow-lg">
          <span className="text-sm font-bold">
            Selected: {selected.size} / {columns.length}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 shadow-xl">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full table-auto">
            <thead className="bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider text-white border-b-2 border-slate-600">
                  Feature Name
                </th>
                <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider text-white border-b-2 border-slate-600">
                  Include in Analysis
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
                  )} ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                >
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800 whitespace-nowrap">
                    {col}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <label className="inline-flex items-center justify-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="h-6 w-6 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        checked={selected.has(col)}
                        onChange={() => toggle(col)}
                      />
                      <span
                        className={`font-bold transition-colors ${
                          selected.has(col)
                            ? "text-blue-700"
                            : "text-slate-400 group-hover:text-blue-500"
                        }`}
                      >
                        {selected.has(col) ? "✓ Selected" : "Select"}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        {onPrevious && (
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
        )}
        <button
          type="button"
          className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-4 text-white font-bold text-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transition-all duration-300 card-hover-lift"
          onClick={handleSubmit}
          disabled={submitting || !filePath || selected.size === 0}
        >
          {submitting ? (
            <>
              <span>⏳</span>
              <span>Confirming...</span>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>Confirm Selection</span>
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
