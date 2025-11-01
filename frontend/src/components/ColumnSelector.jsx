import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const SET_TYPES_URL = "http://localhost:5000/api/column-types";

export default function ColumnSelector({
  filePath,
  columns = [],
  onSubmit,
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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Select Column Types</h2>
        <div className="text-xs text-slate-500">
          File: <span className="font-mono">{filePath || "(none)"}</span>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full table-auto">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                Column
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                Categorical
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                Continuous
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(columns || []).map((col) => (
              <tr key={col} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">
                  {col}
                </td>
                <td className="px-4 py-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selections[col] === "categorical"}
                      onChange={() => toggle(col, "categorical")}
                    />
                    <span>Cat.</span>
                  </label>
                </td>
                <td className="px-4 py-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selections[col] === "continuous"}
                      onChange={() => toggle(col, "continuous")}
                    />
                    <span>Cont.</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Selected — Cat: {categorical.length} · Cont: {continuous.length}
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting || !filePath}
        >
          {submitting ? "Saving..." : "Save & Continue"}
        </button>
      </div>

      {submitting && (
        <div className="mt-3">
          <Spinner text="Saving selections..." />
        </div>
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
