import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

import { useEffect, useState } from "react";
import axios from "axios";

const PREPROCESS_URL = "http://localhost:5000/api/preprocess";

export default function Preprocess({ filePath }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function runPreprocess() {
      if (!filePath) return;
      setLoading(true);
      setError("");
      setResult(null);
      try {
        const res = await axios.post(
          PREPROCESS_URL,
          { file_path: filePath },
          { headers: { "Content-Type": "application/json" } }
        );
        if (cancelled) return;
        setResult(res.data);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.error || err.message || "Preprocess failed";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    runPreprocess();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const datasetShape = Array.isArray(result?.dataset_shape)
    ? result.dataset_shape
    : null;
  const missingValues = result?.missing_values || {};

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold mb-3">Preprocess</h2>

      {!filePath && (
        <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
          Please upload a dataset first.
        </div>
      )}

      {loading && (
        <div className="my-4">
          <Spinner text="Running preprocessing..." />
        </div>
      )}

      {error && (
        <div className="my-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {!loading && !error && result && (
        <div className="space-y-4">
          {/* Success message */}
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-green-800">
            {result.message || "Preprocessing complete"}
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dataset shape */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-700 mb-2">Dataset Shape</h3>
              {datasetShape ? (
                <div className="text-sm text-slate-800">
                  Rows: <span className="font-semibold">{datasetShape[0]}</span>
                  <span className="mx-2">·</span>
                  Columns:{" "}
                  <span className="font-semibold">{datasetShape[1]}</span>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Not available</div>
              )}
              {result?.cleaned_file_path && (
                <div className="mt-2 text-xs text-slate-500">
                  Saved as:{" "}
                  <span className="font-mono">{result.cleaned_file_path}</span>
                </div>
              )}
            </div>

            {/* Missing values */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-700 mb-2">
                Missing Values (before fill)
              </h3>
              {missingValues && Object.keys(missingValues).length > 0 ? (
                <div className="max-h-64 overflow-auto">
                  <table className="min-w-full table-auto">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                          Column
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                          Missing
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(missingValues).map(([col, count]) => (
                        <tr key={col}>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            {col}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-700">
                            {count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-slate-500">
                  No missing values summary available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
