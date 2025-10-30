import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const SELECT_URL = "http://localhost:5000/select_features"; // Flask route

export default function FeatureSelector({ filePath, columns = [], onSelect }) {
  const [selected, setSelected] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ visible: false, type: "success", message: "" });

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
      const msg = err?.response?.data?.error || err.message || "Failed to select features";
      setError(msg);
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Select Features</h2>
        <div className="text-xs text-slate-500">
          File: <span className="font-mono">{filePath || "(none)"}</span>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50"
          onClick={selectAll}
          disabled={!columns.length}
        >
          Select All
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50"
          onClick={clearAll}
          disabled={!columns.length}
        >
          Clear
        </button>
        <div className="text-xs text-slate-500">
          Selected: <span className="font-medium">{selected.size}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                Feature
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                Include
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(columns || []).map((col) => (
              <tr key={col} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">{col}</td>
                <td className="px-4 py-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.has(col)}
                      onChange={() => toggle(col)}
                    />
                    <span>Selected</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting || !filePath || selected.size === 0}
        >
          {submitting ? "Confirming..." : "Confirm Selection"}
        </button>
      </div>

      {submitting && (
        <div className="mt-3"><Spinner text="Submitting selection..." /></div>
      )}

      {/* Toast */}
      {toast.visible && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-3 shadow-lg ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          } text-white`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
