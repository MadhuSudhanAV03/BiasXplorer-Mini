import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const FIX_SKEW_URL = "http://localhost:5000/api/skewness/fix";

export default function SkewnessFixSandbox({
  filePath,
  continuous = [],
  skewnessResults = {},
  onFixComplete,
  initialSelectedColumns = [],
  hideApplyButton = false,
  hideResults = false, // New prop to hide results
  initialResult = null, // New prop to restore previous results
  onStateChange,
}) {
  // Auto-select all columns that need fixing
  const columnsNeedingFix = continuous.filter((col) => {
    const skew = skewnessResults[col]?.skewness;
    return skew !== null && skew !== undefined && Math.abs(skew) > 0.5;
  });

  const [selectedColumns, setSelectedColumns] = useState(
    () =>
      new Set(
        initialSelectedColumns.length > 0
          ? initialSelectedColumns
          : columnsNeedingFix
      )
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(initialResult); // Initialize with previous result

  // Use ref to always get the latest filePath value
  const filePathRef = useRef(filePath);

  // Update ref when filePath changes
  useEffect(() => {
    console.log("[SkewnessFixSandbox] filePath updated:", filePath);
    filePathRef.current = filePath;
  }, [filePath]);

  // Expose state to parent if callback provided
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        selectedColumns,
        loading,
        result,
        canApply: filePath && selectedColumns.size > 0 && !loading,
        applyFix,
      });
    }
  }, [selectedColumns, loading, result, filePath]);

  const toggleColumn = (col) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  };

  const selectAll = () => {
    const skewedCols = continuous.filter((col) => {
      const skew = skewnessResults[col]?.skewness;
      return skew !== null && skew !== undefined && Math.abs(skew) > 0.5;
    });
    setSelectedColumns(new Set(skewedCols));
  };

  const clearAll = () => setSelectedColumns(new Set());

  const getMethodForSkewness = (skew) => {
    if (skew === null || skew === undefined) return "N/A";
    if (Math.abs(skew) <= 0.5) return "None (already symmetric)";
    if (skew > 0.5 && skew <= 1) return "Square Root";
    if (skew > 1 && skew <= 2) return "Log Transformation";
    if (skew < -0.5 && skew >= -1) return "Squared Power";
    if (skew < -1 && skew >= -2) return "Cubed Power";
    if ((skew > 2 && skew <= 3) || (skew < -2 && skew >= -3))
      return "Yeo-Johnson";
    return "Quantile Transformer";
  };

  const applyFix = async () => {
    setError("");
    setResult(null);

    // Use the ref to get the latest filePath value
    const currentFilePath = filePathRef.current;

    console.log(
      "[SkewnessFixSandbox] applyFix called - filePath prop:",
      filePath
    );
    console.log(
      "[SkewnessFixSandbox] applyFix called - filePathRef.current:",
      currentFilePath
    );

    if (!currentFilePath) {
      setError("No file selected. Please upload/select a dataset first.");
      return;
    }

    if (selectedColumns.size === 0) {
      setError("Please select at least one column to fix.");
      return;
    }

    try {
      setLoading(true);

      // Always use the full path (support both uploads/ and corrected/ paths)
      const payload = {
        filename: currentFilePath,
        columns: Array.from(selectedColumns),
      };

      console.log("[SkewnessFixSandbox] Applying fix with payload:", payload);

      const res = await axios.post(FIX_SKEW_URL, payload, {
        headers: { "Content-Type": "application/json" },
      });

      const finalResult = res.data || {};
      setResult(finalResult);
      // Backend now returns file_path (same as input since it modifies in-place)
      const corrPath = finalResult?.file_path;
      console.log(
        "[SkewnessFixSandbox] Fix completed, working file path:",
        corrPath
      );
      if (corrPath) {
        // Notify parent component that fix is complete with result
        onFixComplete?.(corrPath, finalResult);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err.message ||
        "Skewness fix failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canApply = filePath && selectedColumns.size > 0 && !loading;

  return (
    <div className="w-full">
      {/* Column Fix Settings - directly show options without checkboxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Array.from(selectedColumns).map((col, index) => {
          const skew = skewnessResults[col]?.skewness;
          const method = getMethodForSkewness(skew);

          // Skewness severity emoji
          const skewEmoji =
            skew === null || skew === undefined
              ? "⚪"
              : Math.abs(skew) <= 0.5
              ? "🟢"
              : Math.abs(skew) <= 1
              ? "🟡"
              : Math.abs(skew) <= 2
              ? "🟠"
              : "🔴";

          return (
            <div
              key={col}
              className="p-5 rounded-xl border-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400 shadow-md transition-all duration-300 hover:shadow-lg animate-fadeInUp"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base font-bold text-slate-900">
                    {col}
                  </span>
                  <span className="text-lg">{skewEmoji}</span>
                </div>
                <div className="text-sm text-slate-600 mb-1 flex items-center gap-2">
                  <span className="font-semibold">Skewness:</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg font-bold ${
                      skew === null || skew === undefined
                        ? "bg-slate-100 text-slate-600"
                        : Math.abs(skew) <= 0.5
                        ? "bg-green-100 text-green-700"
                        : Math.abs(skew) <= 1
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {skew !== null && skew !== undefined
                      ? skew.toFixed(3)
                      : "N/A"}
                  </span>
                </div>
                <div className="text-sm flex items-center gap-2">
                  <span className="font-semibold text-slate-600">Method:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium">
                    {method}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedColumns.size === 0 && (
        <div className="text-sm text-slate-500 text-center py-8 animate-fadeIn">
          <span className="text-3xl mb-2 block">📭</span>
          No continuous columns available
        </div>
      )}

      {/* Apply Button */}
      {!hideApplyButton && (
        <div className="mb-6">
          <button
            type="button"
            onClick={applyFix}
            disabled={!canApply}
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-4 text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 disabled:hover:scale-100 animate-pulseGlow"
          >
            {loading ? (
              <>
                <Spinner />
                <span className="ml-2">Applying transformations...</span>
              </>
            ) : (
              <>
                <span className="text-2xl">✨</span>
                <span>
                  Apply Fix to {selectedColumns.size} Column
                  {selectedColumns.size !== 1 ? "s" : ""}
                </span>
                {selectedColumns.size > 0 && (
                  <span className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-lg">
                    {selectedColumns.size}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="my-6 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 animate-pulseGlow">
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-lg font-bold text-blue-800 animate-pulse">
              Applying skewness corrections...
            </p>
            <p className="text-sm text-slate-600">
              Transforming distributions for better symmetry
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="my-6 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 p-6 text-sm text-red-700 border-2 border-red-300 shadow-lg animate-fadeInUp">
          <div className="flex items-start gap-3">
            <span className="text-2xl">❌</span>
            <div className="flex-1">
              <p className="font-bold text-red-800 mb-1">Error occurred</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {!loading && result && !hideResults && (
        <div className="mt-6 rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 shadow-xl animate-fadeInUp">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">✨</span>
            <div>
              <h3 className="text-2xl font-bold text-green-800 flex items-center gap-2">
                Transformation Applied Successfully!
                <span className="text-green-600">✓</span>
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Your data distributions have been normalized
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-white rounded-xl border-2 border-green-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💾</span>
              <span className="font-bold text-slate-700">
                Working File (Modified In-Place):
              </span>
            </div>
            <div className="font-mono text-blue-600 text-sm break-all bg-blue-50 p-3 rounded-lg border border-blue-200">
              {result.file_path || "N/A"}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border-2 border-slate-200 shadow-lg">
            <table className="min-w-full table-auto bg-white">
              <thead className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      Column
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>📉</span>
                      Original
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>📈</span>
                      New Skewness
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>🛠️</span>
                      Method
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(result.transformations || {}).map(
                  ([col, info], index) => {
                    // Use detected skewness value for display (from detection phase)
                    // This ensures consistency even if categorical fixes modified the dataset
                    const displayOriginalSkewness =
                      skewnessResults[col]?.skewness !== undefined &&
                      skewnessResults[col]?.skewness !== null
                        ? skewnessResults[col].skewness
                        : info.original_skewness;

                    return (
                      <tr
                        key={col}
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 animate-fadeInUp"
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">
                          {col}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {info.error ? (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg border border-red-300 font-semibold">
                              {info.error}
                            </span>
                          ) : displayOriginalSkewness !== null &&
                            displayOriginalSkewness !== undefined ? (
                            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg border border-red-200 font-medium">
                              {displayOriginalSkewness.toFixed(3)}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {info.error ? (
                            <span className="text-slate-400">-</span>
                          ) : info.new_skewness !== null ? (
                            <span
                              className={`px-3 py-1 rounded-lg border-2 font-bold shadow-sm ${
                                Math.abs(info.new_skewness) <= 0.5
                                  ? "bg-green-50 text-green-700 border-green-300"
                                  : "bg-yellow-50 text-yellow-700 border-yellow-300"
                              }`}
                            >
                              {info.new_skewness.toFixed(3)}
                            </span>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {info.error ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span className="px-3 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-lg border border-blue-300 font-semibold inline-block">
                              {info.method}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm animate-fadeInUp">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <p className="font-bold text-blue-800 mb-2 text-sm">
                  Success! What's Next?
                </p>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>
                      The corrected dataset has been saved to your corrected
                      folder
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>
                      Skewness values closer to 0 indicate more symmetric
                      distributions
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">→</span>
                    <span className="font-medium">
                      View detailed visualizations in the{" "}
                      <span className="text-blue-700 font-bold">
                        Visualization section
                      </span>{" "}
                      📈
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
