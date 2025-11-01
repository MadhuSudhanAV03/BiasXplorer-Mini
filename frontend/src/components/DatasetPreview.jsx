import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const PREVIEW_URL = "http://localhost:5000/api/preview";

export default function DatasetPreview({ filePath, onNext }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchPreview() {
      if (!filePath) return;
      setLoading(true);
      setError("");
      try {
        const res = await axios.post(
          PREVIEW_URL,
          { file_path: filePath },
          { headers: { "Content-Type": "application/json" } }
        );
        if (cancelled) return;
        setColumns(Array.isArray(res.data?.columns) ? res.data.columns : []);
        setRows(Array.isArray(res.data?.preview) ? res.data.preview : []);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.error || err.message || "Failed to load preview";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const hasData = useMemo(
    () => columns.length > 0 && rows.length > 0,
    [columns, rows]
  );

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold mb-3">Dataset Preview</h2>
      {loading && (
        <div className="my-4">
          <Spinner text="Loading preview..." />
        </div>
      )}
      {error && (
        <div className="my-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {!loading && !error && hasData && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full table-auto">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap"
                    >
                      {row?.[col] != null ? String(row[col]) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => onNext?.({ filePath, columns })}
          disabled={!filePath || loading || !columns.length}
        >
          Next
        </button>
      </div>
    </div>
  );
}
