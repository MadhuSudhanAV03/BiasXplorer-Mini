import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const PREPROCESS_URL = "http://localhost:5000/api/preprocess";

export default function Preprocess({
  filePath,
  selectedColumns = [],
  categorical = [],
  continuous = [],
  onComplete,
  onPrevious,
  onNext,
}) {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [columnStats, setColumnStats] = useState({});
  const [fillStrategies, setFillStrategies] = useState({});

  // Analyze dataset on mount to get missing value counts
  useEffect(() => {
    async function analyzeDataset() {
      if (!filePath || !selectedColumns.length) return;

      setAnalyzing(true);
      try {
        // Fetch preview to get missing value stats from the full dataset
        const res = await axios.post(
          "http://localhost:5000/api/preview",
          { file_path: filePath },
          { headers: { "Content-Type": "application/json" } }
        );

        // Calculate missing values for selected columns using full dataset stats
        const stats = {};
        const initialStrategies = {};
        const fullMissingValues = res.data?.missing_values || {};

        for (const col of selectedColumns) {
          // Get missing count from backend (full dataset, not just preview)
          const missingCount = fullMissingValues[col] || 0;

          stats[col] = {
            missingCount,
            isCategorical: categorical.includes(col),
            isContinuous: continuous.includes(col),
          };

          // Set default strategy to 'keep' (do nothing)
          initialStrategies[col] = "keep";
        }

        setColumnStats(stats);
        setFillStrategies(initialStrategies);
      } catch (err) {
        console.error("Failed to analyze dataset:", err);
        // Set default strategies even if analysis fails
        const initialStrategies = {};
        selectedColumns.forEach((col) => {
          initialStrategies[col] = "keep";
        });
        setFillStrategies(initialStrategies);
      } finally {
        setAnalyzing(false);
      }
    }

    analyzeDataset();
  }, [filePath, selectedColumns, categorical, continuous, onComplete]);

  const handleStrategyChange = (column, strategy) => {
    setFillStrategies((prev) => ({
      ...prev,
      [column]: strategy,
    }));
  };

  const handleApplyPreprocessing = async () => {
    if (!filePath) {
      setError("No file selected. Please upload a dataset first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await axios.post(
        PREPROCESS_URL,
        {
          file_path: filePath,
          selected_columns: selectedColumns,
          fill_strategies: fillStrategies,
        },
        { headers: { "Content-Type": "application/json" } }
      );

      setResult(res.data);

      // File was modified in-place, so the filePath remains the same
      // Notify parent that preprocessing is complete (no new file path)
      if (onComplete) {
        onComplete({
          cleanedFilePath: res.data?.file_path || filePath,
          modifiedInPlace: true,
        });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || "Preprocess failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getStrategyOptions = (column) => {
    const isCat = categorical.includes(column);
    const isCont = continuous.includes(column);

    if (isCat) {
      return [
        { value: "keep", label: "Do nothing (keep missing values)" },
        { value: "remove", label: "Remove rows with missing values" },
        { value: "mode", label: "Fill with most frequent value (mode)" },
      ];
    } else if (isCont) {
      return [
        { value: "keep", label: "Do nothing (keep missing values)" },
        { value: "remove", label: "Remove rows with missing values" },
        { value: "mean", label: "Fill with mean" },
      ];
    } else {
      // Unknown type, provide all options
      return [
        { value: "keep", label: "Do nothing (keep missing values)" },
        { value: "remove", label: "Remove rows with missing values" },
        { value: "mode", label: "Fill with most frequent value (mode)" },
      ];
    }
  };

  const datasetShape = Array.isArray(result?.dataset_shape)
    ? result.dataset_shape
    : null;
  const missingValues = result?.missing_values || {};
  const fillActions = result?.fill_actions || {};

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center gap-3">
        <div className="text-4xl animate-float">🧹</div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Data Preprocessing
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Choose how to handle missing values for each column
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

      {analyzing && (
        <div className="my-8 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-purple-200 shadow-xl">
          <Spinner text="Analyzing dataset..." />
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 animate-pulse">
              Checking for missing values and data quality issues
            </p>
          </div>
        </div>
      )}

      {!analyzing && !result && selectedColumns.length > 0 && (
        <div className="space-y-6 animate-fadeInUp">
          {/* Column-by-column strategy selection */}
          <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <span>⚙️</span>
              <span>Missing Value Handling Strategy</span>
            </h3>
            <p className="text-sm text-blue-700 mb-6">
              Select how to handle missing values for each column
            </p>

            <div className="space-y-4">
              {selectedColumns.map((column) => {
                const stats = columnStats[column] || {};
                const hasMissing = stats.missingCount > 0;
                const isCat = categorical.includes(column);
                const isCont = continuous.includes(column);
                const typeLabel = isCat
                  ? "Categorical"
                  : isCont
                  ? "Continuous"
                  : "Unknown";
                const typeColor = isCat
                  ? "bg-purple-100 text-purple-700"
                  : "bg-green-100 text-green-700";

                return (
                  <div
                    key={column}
                    className="bg-white rounded-xl p-5 shadow-md border-2 border-slate-200 hover:border-blue-300 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-slate-800 text-base">
                            {column}
                          </h4>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${typeColor}`}
                          >
                            {typeLabel}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              hasMissing
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {hasMissing ? "⚠️" : "✅"} {stats.missingCount || 0}{" "}
                            missing value
                            {stats.missingCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {getStrategyOptions(column).map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            fillStrategies[column] === option.value
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-blue-300 bg-white"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`strategy-${column}`}
                            value={option.value}
                            checked={fillStrategies[column] === option.value}
                            onChange={() =>
                              handleStrategyChange(column, option.value)
                            }
                            className="w-4 h-4 text-blue-600"
                          />
                          <span
                            className={`text-sm font-medium ${
                              fillStrategies[column] === option.value
                                ? "text-blue-900"
                                : "text-slate-700"
                            }`}
                          >
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Apply button */}
          <div className="flex justify-between items-center">
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
              onClick={handleApplyPreprocessing}
              disabled={loading}
              className="px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {loading ? (
                <>
                  <span>⏳</span>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Apply Preprocessing</span>
                </>
              )}
            </button>
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
              {result.selected_columns_cleaned &&
                result.selected_columns_cleaned.length > 0 && (
                  <div className="mt-3 p-3 bg-green-100/50 rounded-lg border border-green-300">
                    <p className="text-xs font-semibold text-green-900 mb-2">
                      📋 Cleaned Columns (
                      {result.selected_columns_cleaned.length}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.selected_columns_cleaned.map((col) => (
                        <span
                          key={col}
                          className="px-2 py-1 bg-green-200 text-green-800 rounded-md text-xs font-medium"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
                      💾 Working File (Modified In-Place):
                    </div>
                    <div className="text-xs font-mono text-blue-700 break-all">
                      {result?.file_path?.split("/").pop() ||
                        filePath?.split("/").pop()}
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

          {/* Continue button after successful preprocessing */}
          {onNext && (
            <div className="flex justify-center mt-6">
              <button
                onClick={onNext}
                className="px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift flex items-center gap-3"
              >
                <span>Continue to Bias Detection</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
