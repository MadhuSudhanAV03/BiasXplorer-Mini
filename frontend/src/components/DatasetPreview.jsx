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
      <h2 className="text-lg font-semibold mb-3">Dataset Preview</h2>

      {!filePath && (
        <div className="my-3 rounded-md bg-blue-50 p-3 text-sm text-blue-700 border border-blue-200">
          No file path provided. Please upload a dataset first.
        </div>
      )}

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
        <div>
          <div className="mb-3 text-sm text-slate-600">
            Showing {rows.length} rows × {columns.length} columns
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[600px] overflow-y-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-slate-50 sticky top-0">
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
              <tbody className="divide-y divide-slate-100 bg-white">
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
        </div>
      )}
      {!loading && !error && !hasData && filePath && (
        <div className="my-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
          No data available for preview. The file may be empty or in an
          unexpected format.
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
