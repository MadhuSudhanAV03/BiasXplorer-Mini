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
      setColumns([]);
      setRows([]);
      try {
        const res = await axios.post(
          PREVIEW_URL,
          { file_path: filePath },
          { headers: { "Content-Type": "application/json" } }
        );
        if (cancelled) return;

        console.log("Preview API response:", res.data); // Debug log

        const cols = Array.isArray(res.data?.columns) ? res.data.columns : [];
        const rowsData = Array.isArray(res.data?.preview)
          ? res.data.preview
          : [];

        console.log("Parsed columns:", cols.length, cols); // Debug log
        console.log("Parsed rows:", rowsData.length); // Debug log

        setColumns(cols);
        setRows(rowsData);

        if (cols.length === 0 && !res.data?.error) {
          setError(
            "No columns found in dataset. The file may be empty or corrupted."
          );
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.error || err.message || "Failed to load preview";
        setError(msg);
        console.error("Preview fetch error:", err); // Debug log
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
      <div className="mb-6 flex items-center gap-3">
        <div className="text-4xl">📂</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dataset Preview</h2>
          <p className="text-sm text-slate-600 mt-1">
            Review your data structure and content
          </p>
        </div>
      </div>

      {!filePath && (
        <div className="my-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-2 border-blue-200 shadow-lg flex items-center gap-3 animate-slideInLeft">
          <span className="text-3xl">ℹ️</span>
          <div>
            <h3 className="font-bold text-blue-900 mb-1">No File Selected</h3>
            <p className="text-sm text-blue-700">
              Please upload a dataset to begin exploring your data.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="my-8 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl border-2 border-blue-200 shadow-xl">
          <Spinner text="Loading your dataset..." />
          <p className="mt-4 text-sm text-slate-600 animate-pulse">
            This may take a moment for larger files
          </p>
        </div>
      )}

      {error && (
        <div className="my-4 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 p-6 border-2 border-red-200 shadow-lg flex items-center gap-3 animate-slideInLeft">
          <span className="text-3xl">❌</span>
          <div>
            <h3 className="font-bold text-red-900 mb-1">Error Loading Data</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && hasData && (
        <div className="animate-fadeInUp">
          <div className="mb-4 flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-bold text-green-900">
                  Data Loaded Successfully
                </h3>
                <p className="text-sm text-green-700">
                  Showing{" "}
                  <span className="font-semibold">{rows.length} rows</span> ×{" "}
                  <span className="font-semibold">
                    {columns.length} columns
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 shadow-2xl">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full table-auto">
                <thead className="bg-gradient-to-r from-slate-700 to-slate-800 sticky top-0 z-10">
                  <tr>
                    {columns.map((col, idx) => (
                      <th
                        key={col}
                        className={`px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-white border-b-2 border-slate-600 whitespace-nowrap animate-fadeInDown stagger-${Math.min(
                          (idx % 6) + 1,
                          6
                        )}`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50"
                      }`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-6 py-3 text-sm text-slate-700 whitespace-nowrap"
                        >
                          {row?.[col] != null ? (
                            String(row[col])
                          ) : (
                            <span className="text-slate-400 italic">null</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !hasData && filePath && (
        <div className="my-4 rounded-2xl bg-gradient-to-r from-yellow-50 to-amber-50 p-6 border-2 border-yellow-200 shadow-lg flex items-center gap-3 animate-slideInLeft">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="font-bold text-yellow-900 mb-1">
              No Data Available
            </h3>
            <p className="text-sm text-yellow-700">
              The file appears to be empty or in an unexpected format. Please
              check your file and try again.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="button"
          className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-white font-bold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transition-all duration-300 card-hover-lift"
          onClick={() => onNext?.({ filePath, columns })}
          disabled={!filePath || loading || !columns.length}
        >
          <span>Continue to Next Step</span>
          <span className="group-hover:translate-x-1 transition-transform">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
