import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const PREPROCESS_URL = "http://localhost:5000/api/preprocess";

export default function Preprocess({ filePath, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function runPreprocess() {
      if (!filePath) return;

      // Skip if file is already cleaned
      if (filePath.includes("cleaned_")) {
        setResult({
          message: "File already preprocessed",
          cleaned_file_path: filePath,
          dataset_shape: null,
          missing_values: {},
        });
        if (onComplete) {
          onComplete({ cleanedFilePath: filePath });
        }
        return;
      }

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
        // Notify parent with cleaned file path if available
        if (res.data?.cleaned_file_path && onComplete) {
          onComplete({ cleanedFilePath: res.data.cleaned_file_path });
        }
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
  }, [filePath, onComplete]);

  const datasetShape = Array.isArray(result?.dataset_shape)
    ? result.dataset_shape
    : null;
  const missingValues = result?.missing_values || {};

  const isAlreadyCleaned = filePath && filePath.includes("cleaned_");

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold mb-3">Preprocess</h2>

      {!filePath && (
        <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
          Please upload a dataset first.
        </div>
      )}

      {isAlreadyCleaned && (
        <div className="mb-3 rounded-md bg-blue-50 p-3 text-sm text-blue-800 border border-blue-200">
          ℹ️ This file has already been preprocessed. Skipping cleaning step.
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

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Rows Removed */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-700 mb-2">Rows Removed</h3>
              <div className="space-y-1 text-sm">
                <div className="text-slate-800">
                  Before:{" "}
                  <span className="font-semibold">
                    {result.rows_before || 0}
                  </span>
                </div>
                <div className="text-red-600">
                  With NaN:{" "}
                  <span className="font-semibold">
                    -{result.rows_with_na_removed || 0}
                  </span>
                </div>
                <div className="text-orange-600">
                  Duplicates:{" "}
                  <span className="font-semibold">
                    -{result.duplicates_removed || 0}
                  </span>
                </div>
                <div className="text-green-600 font-semibold pt-1 border-t">
                  After: {result.rows_after || 0}
                </div>
              </div>
            </div>

            {/* Dataset shape */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-700 mb-2">Final Dataset</h3>
              {datasetShape ? (
                <div className="text-sm text-slate-800 space-y-1">
                  <div>
                    Rows:{" "}
                    <span className="font-semibold">{datasetShape[0]}</span>
                  </div>
                  <div>
                    Columns:{" "}
                    <span className="font-semibold">{datasetShape[1]}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Not available</div>
              )}
              {result?.cleaned_file_path && (
                <div className="mt-3 text-xs text-slate-500">
                  Saved as:{" "}
                  <span className="font-mono text-blue-600">
                    {result.cleaned_file_path}
                  </span>
                </div>
              )}
            </div>

            {/* Missing values */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-700 mb-2">
                Missing Values Found
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
                <div className="text-sm text-green-600">
                  ✓ No missing values detected
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
