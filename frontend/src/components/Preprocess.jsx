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
      <div className="mb-6 flex items-center gap-3">
        <div className="text-4xl animate-float">🧹</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Data Preprocessing
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Clean and prepare your dataset for analysis
          </p>
        </div>
      </div>

      {!filePath && (
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-yellow-50 to-amber-50 p-6 border-2 border-yellow-200 shadow-lg flex items-center gap-3 animate-slideInLeft">
          <span className="text-3xl">⚠️</span>
          <div>
            <h3 className="font-bold text-yellow-900 mb-1">No File Selected</h3>
            <p className="text-sm text-yellow-700">
              Please upload a dataset first to begin preprocessing.
            </p>
          </div>
        </div>
      )}

      {isAlreadyCleaned && (
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-2 border-blue-200 shadow-lg flex items-center gap-3 animate-slideInLeft">
          <span className="text-3xl">✅</span>
          <div>
            <h3 className="font-bold text-blue-900 mb-1">
              Already Preprocessed
            </h3>
            <p className="text-sm text-blue-700">
              This file has already been cleaned and preprocessed. Skipping
              cleaning step.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="my-8 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-200 shadow-xl">
          <Spinner text="Cleaning your data..." />
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 animate-pulse mb-2">
              Removing missing values, duplicates, and inconsistencies
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <span className="animate-bounce">🔍</span>
              <span>This may take a moment...</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="my-4 rounded-2xl bg-gradient-to-r from-red-50 to-pink-50 p-6 border-2 border-red-200 shadow-lg flex items-center gap-3 animate-slideInLeft">
          <span className="text-3xl">❌</span>
          <div>
            <h3 className="font-bold text-red-900 mb-1">Preprocessing Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && result && (
        <div className="space-y-6 animate-fadeInUp">
          {/* Success message */}
          <div className="rounded-2xl border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 p-6 shadow-lg flex items-center gap-4">
            <div className="text-5xl">✨</div>
            <div>
              <h3 className="text-xl font-bold text-green-900 mb-1">
                Preprocessing Complete!
              </h3>
              <p className="text-sm text-green-700">
                {result.message ||
                  "Your dataset has been cleaned and is ready for analysis"}
              </p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rows Removed */}
            <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-6 shadow-xl card-hover-lift animate-scaleIn">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🗑️</span>
                <h3 className="font-bold text-red-900 text-lg">Data Cleaned</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                  <span className="text-slate-700">Before:</span>
                  <span className="font-bold text-slate-900 text-lg">
                    {result.rows_before || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-100 rounded-lg">
                  <span className="text-red-700">Removed (NaN):</span>
                  <span className="font-bold text-red-900">
                    -{result.rows_with_na_removed || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-100 rounded-lg">
                  <span className="text-orange-700">Duplicates:</span>
                  <span className="font-bold text-orange-900">
                    -{result.duplicates_removed || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg border-2 border-green-600 mt-3">
                  <span className="text-white font-bold">After:</span>
                  <span className="font-bold text-white text-xl">
                    {result.rows_after || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Dataset shape */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-xl card-hover-lift animate-scaleIn stagger-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📊</span>
                <h3 className="font-bold text-blue-900 text-lg">
                  Final Dataset
                </h3>
              </div>
              {datasetShape ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-white/70 rounded-lg">
                    <span className="text-slate-700 font-semibold">Rows:</span>
                    <span className="font-bold text-blue-900 text-xl">
                      {datasetShape[0]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white/70 rounded-lg">
                    <span className="text-slate-700 font-semibold">
                      Columns:
                    </span>
                    <span className="font-bold text-indigo-900 text-xl">
                      {datasetShape[1]}
                    </span>
                  </div>
                  <div className="mt-4 p-3 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg border border-blue-300">
                    <div className="text-xs font-semibold text-blue-900 mb-1">
                      💾 Saved Location:
                    </div>
                    <div className="text-xs font-mono text-blue-700 break-all">
                      {result?.cleaned_file_path?.split("/").pop() ||
                        result?.cleaned_file_path}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 text-center py-8">
                  Not available
                </div>
              )}
            </div>

            {/* Missing values */}
            <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-xl card-hover-lift animate-scaleIn stagger-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔍</span>
                <h3 className="font-bold text-purple-900 text-lg">
                  Missing Values
                </h3>
              </div>
              {missingValues && Object.keys(missingValues).length > 0 ? (
                <div className="max-h-64 overflow-auto rounded-xl border border-purple-200">
                  <table className="min-w-full table-auto">
                    <thead className="bg-gradient-to-r from-purple-100 to-pink-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-purple-900 border-b-2 border-purple-300">
                          Column
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wider text-purple-900 border-b-2 border-purple-300">
                          Count
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100 bg-white">
                      {Object.entries(missingValues).map(([col, count]) => (
                        <tr key={col} className="hover:bg-purple-50">
                          <td className="px-3 py-2 text-sm text-slate-700 font-medium">
                            {col}
                          </td>
                          <td className="px-3 py-2 text-sm text-right">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold text-xs">
                              {count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">✅</div>
                  <div className="text-sm font-bold text-green-700">
                    No missing values detected!
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    Your data is clean and complete
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
