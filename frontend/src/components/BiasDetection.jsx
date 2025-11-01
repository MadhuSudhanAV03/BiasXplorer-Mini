import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const DETECT_BIAS_URL = "http://localhost:5000/detect_bias";
const DETECT_SKEW_URL = "http://localhost:5000/detect_skew";

export default function BiasDetection({
  filePath,
  categorical = [],
  continuous = [],
  onFix,
  onSkewFix,
  initialResults = null,
  initialSkewnessResults = null,
  removedColumns = [],
}) {
  const [loading, setLoading] = useState({});
  const [error, setError] = useState("");
  const [selectedColumns, setSelectedColumns] = useState(new Set());
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
      };
    }
    if (skewness > 0.5) {
      return {
        label: "Right-skewed",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
      };
    }
    if (skewness < -0.5) {
      return {
        label: "Left-skewed",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
      };
    }
    return {
      label: "Symmetric",
      color: "text-green-600",
      bgColor: "bg-green-50 border-green-200",
    };
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
          { file_path: filePath, categorical: [column] },
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
          { file_path: filePath, categorical: columnsToCheck.categorical },
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
              { filename: filenameOnly, column },
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
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">
              Bias Detection
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Analyze class imbalance in categorical columns and skewness in
              continuous columns.
            </p>
          </div>
          <div className="text-sm bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
            <span className="text-slate-500">File:</span>{" "}
            <span className="font-mono text-slate-700">
              {filePath || "(none)"}
            </span>
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

        {/* Categorical Columns Section */}
        {hasCategorical && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-md font-semibold text-slate-800">
                Categorical Columns (Class Imbalance)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
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
                  Select All Categorical
                </button>
                <button
                  type="button"
                  className="text-sm rounded-md bg-green-600 px-3 py-1.5 text-white hover:bg-green-700 disabled:opacity-50"
                  onClick={() => runDetectionForSelected()}
                  disabled={
                    !filePath || !hasCategorical || selectedColumns.size === 0
                  }
                >
                  Check Selected
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {categorical.map((col) => {
                const info = categoricalResults?.[col];
                const isSelected = selectedColumns.has(col);
                const isLoading = loading[col];

                return (
                  <div
                    key={col}
                    className={`p-3 rounded-lg border transition-colors duration-200 ${
                      info
                        ? classNameForSeverity(info.severity)
                        : "border-slate-200"
                    } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
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
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <label
                          htmlFor={`cat-${col}`}
                          className="text-sm font-medium text-slate-700"
                        >
                          {col}
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-sm rounded-md bg-slate-600 px-2 py-1 text-white hover:bg-slate-700 disabled:opacity-50"
                          onClick={() =>
                            runDetectionForColumn(col, "categorical")
                          }
                          disabled={isLoading || !filePath}
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-1">
                              <Spinner className="h-3 w-3" />
                              Analyzing...
                            </span>
                          ) : info ? (
                            "Check Again"
                          ) : (
                            "Check Bias"
                          )}
                        </button>
                        {info &&
                          ["Moderate", "Severe"].includes(info.severity) && (
                            <button
                              type="button"
                              className="text-sm rounded-md bg-amber-600 px-2 py-1 text-white hover:bg-amber-700"
                              onClick={() =>
                                onFix?.({
                                  results: { [col]: info },
                                  fromButton: true,
                                })
                              }
                            >
                              Fix Bias
                            </button>
                          )}
                      </div>
                    </div>

                    {info && (
                      <div className="text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-600">
                              Distribution:
                            </span>
                            <div className="font-mono">
                              {formatDistribution(info)}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-600">Severity:</span>
                            <div className="font-medium">
                              {info.severity || "N/A"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fix All Categorical */}
            {orderedCategoricalEntries.some(([_, info]) =>
              ["Moderate", "Severe"].includes(info?.severity)
            ) && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="text-sm rounded-md bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700"
                  onClick={() => {
                    const resultsToFix = {};
                    orderedCategoricalEntries.forEach(([col, info]) => {
                      if (["Moderate", "Severe"].includes(info?.severity)) {
                        resultsToFix[col] = info;
                      }
                    });
                    onFix?.({ results: resultsToFix, fromButton: true });
                  }}
                >
                  Fix All Categorical Issues
                </button>
              </div>
            )}
          </div>
        )}

        {/* Continuous Columns Section */}
        {hasContinuous && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-md font-semibold text-slate-800">
                Continuous Columns (Skewness)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={() => {
                    setSelectedColumns((prev) => {
                      const newSet = new Set(prev);
                      continuous.forEach((col) => newSet.add(col));
                      return newSet;
                    });
                  }}
                  disabled={!filePath || !hasContinuous}
                >
                  Select All Continuous
                </button>
                <button
                  type="button"
                  className="text-sm rounded-md bg-green-600 px-3 py-1.5 text-white hover:bg-green-700 disabled:opacity-50"
                  onClick={() => runDetectionForSelected()}
                  disabled={
                    !filePath || !hasContinuous || selectedColumns.size === 0
                  }
                >
                  Check Selected
                </button>
              </div>
            </div>

            <div className="space-y-3">
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

                return (
                  <div
                    key={col}
                    className={`p-3 rounded-lg border transition-colors duration-200 ${
                      info && interpretation
                        ? interpretation.bgColor
                        : "border-slate-200"
                    } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
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
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <label
                          htmlFor={`cont-${col}`}
                          className="text-sm font-medium text-slate-700"
                        >
                          {col}
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-sm rounded-md bg-slate-600 px-2 py-1 text-white hover:bg-slate-700 disabled:opacity-50"
                          onClick={() =>
                            runDetectionForColumn(col, "continuous")
                          }
                          disabled={isLoading || !filePath}
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-1">
                              <Spinner className="h-3 w-3" />
                              Analyzing...
                            </span>
                          ) : info ? (
                            "Check Again"
                          ) : (
                            "Check Skewness"
                          )}
                        </button>
                        {info &&
                          info.skewness !== null &&
                          info.skewness !== undefined &&
                          Math.abs(info.skewness) > 0.5 && (
                            <button
                              type="button"
                              className="text-sm rounded-md bg-green-600 px-2 py-1 text-white hover:bg-green-700"
                              onClick={() =>
                                onSkewFix?.({
                                  skewnessResults: { [col]: info },
                                  fromButton: true,
                                })
                              }
                            >
                              Fix Skewness
                            </button>
                          )}
                      </div>
                    </div>

                    {info && (
                      <div className="text-sm">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <span className="text-slate-600">Skewness:</span>
                            <div className="font-mono">
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
                          <div>
                            <span className="text-slate-600">
                              Non-null Count:
                            </span>
                            <div>{info?.n_nonnull || 0}</div>
                          </div>
                          <div>
                            <span className="text-slate-600">
                              Interpretation:
                            </span>
                            <div
                              className={`font-medium ${interpretation?.color}`}
                            >
                              {info?.error ? "-" : interpretation?.label}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Fix All Continuous */}
            {orderedSkewnessEntries.some(([_, info]) => {
              const skewValue = info?.skewness;
              return (
                skewValue !== null &&
                skewValue !== undefined &&
                Math.abs(skewValue) > 0.5
              );
            }) && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="text-sm rounded-md bg-green-600 px-3 py-1.5 text-white hover:bg-green-700"
                  onClick={() => {
                    const resultsToFix = {};
                    orderedSkewnessEntries.forEach(([col, info]) => {
                      const skewValue = info?.skewness;
                      if (
                        skewValue !== null &&
                        skewValue !== undefined &&
                        Math.abs(skewValue) > 0.5
                      ) {
                        resultsToFix[col] = info;
                      }
                    });
                    onSkewFix?.({
                      skewnessResults: resultsToFix,
                      fromButton: true,
                    });
                  }}
                >
                  Fix All Skewness Issues
                </button>
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500 bg-slate-50 p-3 rounded">
              <strong>Note:</strong> Skewness &gt; 0.5 = Right-skewed, &lt; -0.5
              = Left-skewed, -0.5 to 0.5 = Symmetric
            </div>
          </div>
        )}

        {/* Fix Buttons */}
        {(hasIssues || hasSkewnessIssues) && (
          <div className="mt-6 border-t pt-4 flex gap-2">
            {hasIssues && categoricalResults && (
              <button
                type="button"
                className="rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
                onClick={() =>
                  onFix?.({ results: categoricalResults, fromButton: true })
                }
              >
                Fix Categorical Bias (
                {
                  Object.values(categoricalResults).filter((v) =>
                    ["Moderate", "Severe"].includes(v?.severity)
                  ).length
                }{" "}
                columns)
              </button>
            )}

            {hasSkewnessIssues && (
              <button
                type="button"
                className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                onClick={() =>
                  onSkewFix?.({ skewnessResults, fromButton: true })
                }
              >
                Fix Skewness (
                {
                  Object.values(skewnessResults || {}).filter((v) => {
                    const skewValue = v?.skewness;
                    return (
                      skewValue !== null &&
                      skewValue !== undefined &&
                      Math.abs(skewValue) > 0.5
                    );
                  }).length
                }{" "}
                columns)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
