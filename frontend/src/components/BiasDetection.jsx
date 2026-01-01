import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const DETECT_BIAS_URL = "http://localhost:5000/api/bias/detect";
const DETECT_SKEW_URL = "http://localhost:5000/api/skewness/detect";

export default function BiasDetection({
  filePath,
  categorical = [],
  continuous = [],
  allSelectedColumns = [], // Renamed from selectedColumns to avoid conflict with state
  onFix,
  onSkewFix,
  initialResults = null,
  initialSkewnessResults = null,
  removedColumns = [],
}) {
  const [loading, setLoading] = useState({});
  const [error, setError] = useState("");
  const [selectedColumns, setSelectedColumns] = useState(new Set()); // UI checkbox state
  const [categoricalResults, setCategoricalResults] = useState(() => {
    if (!initialResults) return {};
    const filtered = { ...initialResults };
    removedColumns.forEach((col) => delete filtered[col]);
    return filtered;
  });
  const [skewnessResults, setSkewnessResults] = useState(() => {
    if (!initialSkewnessResults) return {};
    const filtered = { ...initialSkewnessResults };
    removedColumns.forEach((col) => delete filtered[col]);
    return filtered;
  });

  const orderedCategoricalEntries = useMemo(() => {
    if (!categoricalResults) return [];
    const keys = Object.keys(categoricalResults);
    const order = (
      categorical && categorical.length ? categorical : keys
    ).filter((k) => keys.includes(k));
    return order.map((k) => [k, categoricalResults[k]]);
  }, [categoricalResults, categorical]);

  const orderedSkewnessEntries = useMemo(() => {
    if (!skewnessResults) return [];
    try {
      const keys = Object.keys(skewnessResults);
      const order = (
        continuous && continuous.length ? continuous : keys
      ).filter((k) => keys.includes(k));
      return order
        .map((k) => [k, skewnessResults[k]])
        .filter(([_, info]) => info !== undefined);
    } catch (err) {
      console.error("Error processing skewness results:", err);
      return [];
    }
  }, [skewnessResults, continuous]);

  const hasIssues = useMemo(() => {
    if (!categoricalResults) return false;
    return Object.values(categoricalResults).some((v) =>
      ["Moderate", "Severe"].includes(v?.severity)
    );
  }, [categoricalResults]);

  const hasSkewnessIssues = useMemo(() => {
    if (!skewnessResults) return false;
    return Object.values(skewnessResults).some((v) => {
      if (!v) return false;
      const skewValue = v.skewness;
      return (
        skewValue !== null &&
        skewValue !== undefined &&
        Math.abs(skewValue) > 0.5
      );
    });
  }, [skewnessResults]);

  const getSkewnessInterpretation = (skewness) => {
    if (skewness === null || skewness === undefined) {
      return {
        label: "N/A",
        color: "text-gray-500",
        bgColor: "border-slate-200",
        emoji: "❓",
      };
    }
    if (skewness > 1.0) {
      return {
        label: "Highly Right-skewed",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        emoji: "🔴",
      };
    }
    if (skewness > 0.5) {
      return {
        label: "Right-skewed",
        color: "text-orange-600",
        bgColor: "bg-orange-50 border-orange-200",
        emoji: "🟠",
      };
    }
    if (skewness < -1.0) {
      return {
        label: "Highly Left-skewed",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        emoji: "🔴",
      };
    }
    if (skewness < -0.5) {
      return {
        label: "Left-skewed",
        color: "text-orange-600",
        bgColor: "bg-orange-50 border-orange-200",
        emoji: "🟠",
      };
    }
    return {
      label: "Symmetric",
      color: "text-green-600",
      bgColor: "bg-green-50 border-green-200",
      emoji: "✅",
    };
  };

  const getSeverityEmoji = (severity) => {
    switch (severity) {
      case "Severe":
        return "🔴";
      case "Moderate":
        return "🟡";
      case "Low":
        return "🟢";
      default:
        return "⚪";
    }
  };

  // Get columns that need bias detection (not already in results)
  const getNewColumns = () => {
    const newCategorical = categorical.filter(
      (col) => !categoricalResults || !(col in categoricalResults)
    );
    const newContinuous = continuous.filter(
      (col) => !skewnessResults || !(col in skewnessResults)
    );
    return { newCategorical, newContinuous };
  };

  const runDetectionForColumn = async (column, type) => {
    setError("");

    if (!filePath) {
      setError("No file selected. Please upload a dataset first.");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, [column]: true }));

      if (type === "categorical") {
        const res = await axios.post(
          DETECT_BIAS_URL,
          {
            file_path: filePath,
            categorical: [column],
            selected_columns: allSelectedColumns,
          },
          { headers: { "Content-Type": "application/json" } }
        );
        setCategoricalResults((prev) => ({
          ...prev,
          ...res.data,
        }));
        if (onFix) {
          onFix({
            results: { ...categoricalResults, ...res.data },
            fromButton: false,
          });
        }
      } else {
        const filenameOnly = filePath.includes("/")
          ? filePath.split("/").pop()
          : filePath;
        const res = await axios.post(
          DETECT_SKEW_URL,
          { filename: filenameOnly, column },
          { headers: { "Content-Type": "application/json" } }
        );
        setSkewnessResults((prev) => ({
          ...prev,
          [column]: res.data,
        }));
        if (onSkewFix) {
          onSkewFix({
            skewnessResults: {
              ...skewnessResults,
              [column]: res.data,
            },
            fromButton: false,
          });
        }
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        `Failed to analyze ${column}`;
      setError(msg);
    } finally {
      setLoading((prev) => ({ ...prev, [column]: false }));
    }
  };

  const runDetectionForSelected = async () => {
    const selectedCategorical = categorical.filter((col) =>
      selectedColumns.has(col)
    );
    const selectedContinuous = continuous.filter((col) =>
      selectedColumns.has(col)
    );

    for (const col of selectedCategorical) {
      await runDetectionForColumn(col, "categorical");
    }
    for (const col of selectedContinuous) {
      await runDetectionForColumn(col, "continuous");
    }
  };

  const runDetection = async (columnsToCheck) => {
    setError("");

    if (!filePath) {
      setError("No file selected. Please upload a dataset first.");
      return;
    }

    try {
      setLoading((prev) => {
        const newLoading = { ...prev };
        columnsToCheck.categorical?.forEach((col) => (newLoading[col] = true));
        columnsToCheck.continuous?.forEach((col) => (newLoading[col] = true));
        return newLoading;
      });

      // Extract filename from path
      const filenameOnly = filePath.includes("/")
        ? filePath.split("/").pop()
        : filePath;

      // Run categorical bias detection
      if (hasCategorical) {
        const catRes = await axios.post(
          DETECT_BIAS_URL,
          {
            file_path: filePath,
            categorical: columnsToCheck.categorical,
            selected_columns: allSelectedColumns,
          },
          { headers: { "Content-Type": "application/json" } }
        );
        // Merge new results with existing ones
        const newCategoricalResults = {
          ...(categoricalResults || {}),
          ...(catRes.data || {}),
        };
        setCategoricalResults(newCategoricalResults);

        // Notify parent of updated results
        if (onFix) {
          onFix({ results: newCategoricalResults, fromButton: false });
        }
      }

      // Run skewness detection for continuous columns
      if (hasContinuous) {
        const skewPromises = continuous.map((column) =>
          axios
            .post(
              DETECT_SKEW_URL,
              {
                filename: filenameOnly,
                column,
                selected_columns: allSelectedColumns,
              },
              { headers: { "Content-Type": "application/json" } }
            )
            .then((res) => ({ column, data: res.data }))
            .catch((err) => ({
              column,
              error: err?.response?.data?.message || err.message,
            }))
        );

        const skewResponses = await Promise.all(skewPromises);
        const newSkewResults = { ...(skewnessResults || {}) };
        skewResponses.forEach(({ column, data, error }) => {
          if (error) {
            newSkewResults[column] = { error, skewness: null, n_nonnull: 0 };
          } else {
            newSkewResults[column] = data;
          }
        });
        setSkewnessResults(newSkewResults);

        // Notify parent of updated skewness results
        if (onSkewFix) {
          onSkewFix({ skewnessResults: newSkewResults, fromButton: false });
        }
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || "Bias detection failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const classNameForSeverity = (sev) => {
    if (sev === "Severe") return "bg-red-50 border-red-200";
    if (sev === "Moderate") return "bg-yellow-50 border-yellow-200";
    if (sev === "Low") return "bg-green-50 border-green-200";
    return "border-slate-200";
  };

  const formatDistribution = (obj) => {
    if (!obj) return "-";
    const entries = Object.entries(obj).filter(
      ([k]) => k !== "severity" && k !== "note"
    );
    if (entries.length === 0) return obj.note ? obj.note : "-";
    return entries
      .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`)
      .join(", ");
  };

  const hasCategorical = categorical && categorical.length > 0;
  const hasContinuous = continuous && continuous.length > 0;

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-2xl border border-purple-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="text-4xl">🔍</div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              Bias Detection
            </h2>
            <p className="text-sm text-slate-600">
              Analyze class imbalance in categorical columns and skewness in
              continuous columns to identify potential biases in your dataset
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Active File:
              </span>
              <span className="text-sm bg-white px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-slate-700 shadow-sm">
                {filePath
                  ? filePath.split("/").pop() || filePath
                  : "(No file selected)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}

      {/* Categorical Columns Card */}
      {hasCategorical && (
        <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-3">
            <div className="text-3xl">📊</div>
            <div>
              <h3 className="text-xl font-bold text-amber-900">
                Categorical Columns
              </h3>
              <p className="text-sm text-amber-700 mt-0.5">
                Detect class imbalance in categorical feature distributions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              className="text-sm rounded-lg bg-amber-600 px-4 py-2 text-white font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex items-center gap-2"
              onClick={() => {
                const allCategorical = new Set(categorical);
                setSelectedColumns((prev) => {
                  const newSet = new Set(prev);
                  categorical.forEach((col) => newSet.add(col));
                  return newSet;
                });
              }}
              disabled={!filePath || !hasCategorical}
            >
              <span>☑️</span>
              <span>Select All</span>
            </button>
            <button
              type="button"
              className="text-sm rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex items-center gap-2"
              onClick={() => runDetectionForSelected()}
              disabled={
                !filePath || !hasCategorical || selectedColumns.size === 0
              }
            >
              <span>✓</span>
              <span>Check Selected</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {categorical.map((col) => {
              const info = categoricalResults?.[col];
              const isSelected = selectedColumns.has(col);
              const isLoading = loading[col];
              const emoji = info ? getSeverityEmoji(info.severity) : "⚪";

              return (
                <div
                  key={col}
                  className={`relative p-5 rounded-xl border-2 transition-all duration-300 shadow-sm hover:shadow-md ${
                    info
                      ? classNameForSeverity(info.severity)
                      : "bg-white border-slate-200"
                  } ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        id={`cat-${col}`}
                        checked={isSelected}
                        onChange={(e) => {
                          setSelectedColumns((prev) => {
                            const newSet = new Set(prev);
                            if (e.target.checked) {
                              newSet.add(col);
                            } else {
                              newSet.delete(col);
                            }
                            return newSet;
                          });
                        }}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label
                        htmlFor={`cat-${col}`}
                        className="text-base font-semibold text-slate-800 cursor-pointer flex-1"
                      >
                        {col}
                      </label>
                    </div>
                    {info && <div className="text-3xl ml-2">{emoji}</div>}
                  </div>

                  {/* Results Section */}
                  {info && (
                    <div className="space-y-3 mb-4">
                      <div className="bg-white/50 rounded-lg p-3 border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                          Distribution
                        </div>
                        <div className="font-mono text-sm text-slate-800">
                          {formatDistribution(info)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-500 uppercase">
                            Severity
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                                info.severity === "Severe"
                                  ? "bg-red-600 text-white"
                                  : info.severity === "Moderate"
                                  ? "bg-yellow-500 text-white"
                                  : "bg-green-600 text-white"
                              }`}
                            >
                              {info.severity || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="button"
                    className="w-full text-sm rounded-lg bg-slate-700 px-4 py-2.5 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    onClick={() => runDetectionForColumn(col, "categorical")}
                    disabled={isLoading || !filePath}
                  >
                    {isLoading ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        <span>Analyzing...</span>
                      </>
                    ) : info ? (
                      <>
                        <span>🔄</span>
                        <span>Check Again</span>
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>Check Bias</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <span className="text-2xl">💡</span>
              <div className="text-xs text-slate-700">
                <strong className="text-amber-800">Severity Guide:</strong>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span>🔴 Severe:</span>
                    <span>
                      Significant class imbalance requiring correction
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🟡 Moderate:</span>
                    <span>
                      Noticeable imbalance, may affect model performance
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🟢 Low:</span>
                    <span>Minimal imbalance, generally acceptable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continuous Columns Card */}
      {hasContinuous && (
        <div className="rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-3">
            <div className="text-3xl">📈</div>
            <div>
              <h3 className="text-xl font-bold text-blue-900">
                Continuous Columns
              </h3>
              <p className="text-sm text-blue-700 mt-0.5">
                Detect skewness in continuous feature distributions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              className="text-sm rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex items-center gap-2"
              onClick={() => {
                setSelectedColumns((prev) => {
                  const newSet = new Set(prev);
                  continuous.forEach((col) => newSet.add(col));
                  return newSet;
                });
              }}
              disabled={!filePath || !hasContinuous}
            >
              <span>☑️</span>
              <span>Select All</span>
            </button>
            <button
              type="button"
              className="text-sm rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex items-center gap-2"
              onClick={() => runDetectionForSelected()}
              disabled={
                !filePath || !hasContinuous || selectedColumns.size === 0
              }
            >
              <span>✓</span>
              <span>Check Selected</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {continuous.map((col) => {
              const info = skewnessResults?.[col];
              const interpretation = info
                ? getSkewnessInterpretation(info.skewness)
                : null;
              const isSelected = selectedColumns.has(col);
              const isLoading = loading[col];
              const skewValue = info?.skewness;
              const needsFixing =
                skewValue !== null &&
                skewValue !== undefined &&
                Math.abs(skewValue) > 0.5;
              const emoji = interpretation?.emoji || "⚪";

              return (
                <div
                  key={col}
                  className={`relative p-5 rounded-xl border-2 transition-all duration-300 shadow-sm hover:shadow-md ${
                    info && interpretation
                      ? interpretation.bgColor
                      : "bg-white border-slate-200"
                  } ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        id={`cont-${col}`}
                        checked={isSelected}
                        onChange={(e) => {
                          setSelectedColumns((prev) => {
                            const newSet = new Set(prev);
                            if (e.target.checked) {
                              newSet.add(col);
                            } else {
                              newSet.delete(col);
                            }
                            return newSet;
                          });
                        }}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label
                        htmlFor={`cont-${col}`}
                        className="text-base font-semibold text-slate-800 cursor-pointer flex-1"
                      >
                        {col}
                      </label>
                    </div>
                    {info && <div className="text-3xl ml-2">{emoji}</div>}
                  </div>

                  {/* Results Section */}
                  {info && (
                    <div className="space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/50 rounded-lg p-3 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                            Skewness
                          </div>
                          <div className="font-mono text-lg font-bold text-slate-800">
                            {info?.error ? (
                              <span className="text-red-600 text-xs">
                                {info.error}
                              </span>
                            ) : info?.skewness !== null &&
                              info?.skewness !== undefined ? (
                              info.skewness.toFixed(4)
                            ) : (
                              "N/A"
                            )}
                          </div>
                        </div>
                        <div className="bg-white/50 rounded-lg p-3 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                            Non-null
                          </div>
                          <div className="text-lg font-bold text-slate-800">
                            {info?.n_nonnull || 0}
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/50 rounded-lg p-3 border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                          Interpretation
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                              info?.error
                                ? "bg-gray-500 text-white"
                                : needsFixing
                                ? Math.abs(skewValue) > 1.0
                                  ? "bg-red-600 text-white"
                                  : "bg-orange-500 text-white"
                                : "bg-green-600 text-white"
                            }`}
                          >
                            {info?.error ? "Error" : interpretation?.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="button"
                    className="w-full text-sm rounded-lg bg-slate-700 px-4 py-2.5 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    onClick={() => runDetectionForColumn(col, "continuous")}
                    disabled={isLoading || !filePath}
                  >
                    {isLoading ? (
                      <>
                        <span>⏳</span>
                        <span>Analyzing...</span>
                      </>
                    ) : info ? (
                      <>
                        <span>🔄</span>
                        <span>Check Again</span>
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>Check Skewness</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <span className="text-2xl">💡</span>
              <div className="text-xs text-slate-700">
                <strong className="text-blue-800">Skewness Guide:</strong>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span>🔴 Highly skewed:</span>
                    <span className="font-mono">|skew| &gt; 1.0</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>🟠 Moderately skewed:</span>
                    <span className="font-mono">0.5 &lt; |skew| ≤ 1.0</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>✅ Symmetric:</span>
                    <span className="font-mono">|skew| ≤ 0.5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
