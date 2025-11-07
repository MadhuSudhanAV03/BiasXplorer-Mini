import React, { useState, useEffect } from "react";
import axios from "axios";
import Spinner from "./Spinner";
import CategoricalColumnsModal from "./CategoricalColumnsModal";

const FIX_URL = "http://localhost:5000/api/bias/fix";

const METHOD_OPTIONS = [
  { label: "Oversample", value: "oversample" },
  { label: "Undersample", value: "undersample" },
  { label: "SMOTE", value: "smote" },
  { label: "Reweight", value: "reweight" },
];

export default function BiasFixSandbox({
  filePath,
  categorical = [],
  biasResults = {},
  columns = [],
  onFixComplete,
  initialSelectedColumns = [],
  hideApplyButton = false,
  hideResults = false, // New prop to hide results
  initialResult = null, // New prop to restore previous results
  onApplyFix,
  onStateChange,
}) {
  const [selectedColumns, setSelectedColumns] = useState(
    new Set(initialSelectedColumns)
  );
  const [columnSettings, setColumnSettings] = useState({}); // { colName: { method, threshold } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(initialResult); // Initialize with previous result
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);
  const [currentColumn, setCurrentColumn] = useState(null); // For SMOTE modal

  // Update result when initialResult prop changes (for persistence)
  useEffect(() => {
    console.log("[BiasFixSandbox] initialResult changed:", initialResult);
    if (initialResult !== undefined && initialResult !== null) {
      console.log("[BiasFixSandbox] Setting result to:", initialResult);
      setResult(initialResult);
    }
  }, [initialResult]);

  // Debug logging for result state
  useEffect(() => {
    console.log("[BiasFixSandbox] result state:", result);
  }, [result]);

  // Expose state to parent if callback provided
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        selectedColumns,
        columnSettings,
        loading,
        result,
        canApply: filePath && selectedColumns.size > 0 && !loading,
        handleApplyClick,
      });
    }
  }, [selectedColumns, columnSettings, loading, result, filePath]);

  // Initialize settings for pre-selected columns
  useEffect(() => {
    if (initialSelectedColumns && initialSelectedColumns.length > 0) {
      const newSettings = {};
      initialSelectedColumns.forEach((col) => {
        newSettings[col] = {
          method: "oversample",
          threshold: 0.5,
        };
      });
      setColumnSettings(newSettings);
    }
  }, [initialSelectedColumns]); // Run when initialSelectedColumns changes

  const toggleColumn = (col) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
        // Remove settings for this column
        setColumnSettings((prevSettings) => {
          const newSettings = { ...prevSettings };
          delete newSettings[col];
          return newSettings;
        });
      } else {
        next.add(col);
        // Initialize default settings for this column
        if (!columnSettings[col]) {
          setColumnSettings((prevSettings) => ({
            ...prevSettings,
            [col]: {
              method: "oversample",
              threshold: 0.5,
            },
          }));
        }
      }
      return next;
    });
  };

  const selectAll = () => {
    const biasedCols = categorical.filter((col) => {
      const severity = biasResults[col]?.severity;
      return severity === "Moderate" || severity === "Severe";
    });
    setSelectedColumns(new Set(biasedCols));
    // Initialize settings for all selected columns
    const newSettings = { ...columnSettings };
    biasedCols.forEach((col) => {
      if (!newSettings[col]) {
        newSettings[col] = {
          method: "oversample",
          threshold: 0.5,
        };
      }
    });
    setColumnSettings(newSettings);
  };

  const clearAll = () => {
    setSelectedColumns(new Set());
    setColumnSettings({});
  };

  const updateColumnSetting = (col, key, value) => {
    setColumnSettings((prev) => ({
      ...prev,
      [col]: {
        ...prev[col],
        [key]: value,
      },
    }));
  };

  const getDistributionText = (col) => {
    const colData = biasResults[col];
    if (!colData) return "N/A";

    // Distribution values are at the same level as severity, not nested
    // Filter out severity and note to get only the class distribution
    const entries = Object.entries(colData).filter(
      ([key]) => key !== "severity" && key !== "note"
    );

    if (entries.length === 0) return "N/A";

    return entries
      .map(([key, value]) => `${key} ${Number(value).toFixed(2)}`)
      .join(", ");
  };

  const handleApplyClick = () => {
    // Check if any selected column uses SMOTE
    const columnsToFix = Array.from(selectedColumns);
    const smoteColumns = columnsToFix.filter(
      (col) => columnSettings[col]?.method === "smote"
    );

    if (smoteColumns.length > 0) {
      // For now, fix one SMOTE column at a time
      setCurrentColumn(smoteColumns[0]);
      setShowCategoricalModal(true);
    } else {
      applyFix();
    }
  };

  const handleCategoricalModalConfirm = (categoricalCols) => {
    setShowCategoricalModal(false);
    applyFix(categoricalCols);
  };

  const applyFix = async (categoricalCols = []) => {
    setError("");
    setResult(null);

    if (!filePath) {
      setError("No file selected. Please upload/select a dataset first.");
      return;
    }

    if (selectedColumns.size === 0) {
      setError("Please select at least one column to fix.");
      return;
    }

    try {
      setLoading(true);

      const columnsToFix = Array.from(selectedColumns);
      const allResults = {};
      let currentFilePath = filePath;

      // Apply fixes sequentially to each selected column
      for (let i = 0; i < columnsToFix.length; i++) {
        const colToFix = columnsToFix[i];
        const settings = columnSettings[colToFix];

        const payload = {
          file_path: currentFilePath,
          target_column: String(colToFix),
          method: settings?.method || "oversample",
        };

        // Add categorical columns if SMOTE
        if (settings?.method === "smote" && categoricalCols.length > 0) {
          payload.categorical_columns = categoricalCols;
        }

        // Add threshold
        const thr = Number(settings?.threshold || 0.5);
        if (!Number.isNaN(thr) && thr > 0 && thr <= 1) {
          payload.threshold = thr;
        }

        console.log(
          `[BiasFixSandbox] Fixing column ${i + 1}/${columnsToFix.length}:`,
          colToFix,
          payload
        );

        const res = await axios.post(FIX_URL, payload, {
          headers: { "Content-Type": "application/json" },
        });

        // Store result for this column
        allResults[colToFix] = {
          before: res.data?.before,
          after: res.data?.after,
          method: settings?.method,
          threshold: settings?.threshold,
        };

        // Use the corrected file as input for the next iteration
        if (res.data?.corrected_file_path) {
          currentFilePath = res.data.corrected_file_path;
        }
      }

      // Set combined results
      const finalResult = {
        columns: allResults,
        corrected_file_path: currentFilePath,
      };
      setResult(finalResult);

      if (currentFilePath) {
        onFixComplete?.(currentFilePath, finalResult);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || "Bias fix failed";
      setError(msg);
    } finally {
      setLoading(false);
      setCurrentColumn(null);
    }
  };

  const canApply = filePath && selectedColumns.size > 0 && !loading;

  return (
    <div className="w-full">
      {/* Column Selection */}
      <div className="mb-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 shadow-sm animate-fadeInUp">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <h3 className="text-base font-bold text-slate-800">
              Select Columns to Fix
            </h3>
            {selectedColumns.size > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold animate-scaleIn">
                {selectedColumns.size}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              Select All Imbalanced
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs px-4 py-2 rounded-lg bg-white text-slate-700 font-medium hover:bg-slate-100 border border-slate-300 shadow-sm hover:shadow-md transition-all duration-300"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {categorical.map((col, index) => {
            const severity = biasResults[col]?.severity;
            const hasIssue = severity === "Moderate" || severity === "Severe";
            const isSelected = selectedColumns.has(col);
            const settings = columnSettings[col] || {
              method: "oversample",
              threshold: 0.5,
            };

            // Severity emoji mapping
            const severityEmoji = {
              Severe: "🔴",
              Moderate: "🟡",
              Low: "🟢",
            };

            return (
              <div
                key={col}
                className={`p-5 rounded-xl border-2 transition-all duration-300 hover:shadow-lg animate-fadeInUp ${
                  isSelected
                    ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-400 shadow-md scale-[1.02]"
                    : hasIssue
                    ? "bg-white border-slate-300 hover:border-blue-300"
                    : "bg-slate-50 border-slate-200 opacity-60"
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleColumn(col)}
                    disabled={!hasIssue}
                    className="mt-1 w-5 h-5 rounded border-2 border-blue-400 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-bold text-slate-900">
                            {col}
                          </span>
                          {severity && (
                            <span className="text-lg">
                              {severityEmoji[severity] || "⚪"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 flex items-center gap-1">
                          <span className="font-medium">Distribution:</span>
                          <span className="text-slate-700">
                            {getDistributionText(col)}
                          </span>
                        </div>
                      </div>
                      {severity && (
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${
                            severity === "Severe"
                              ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
                              : severity === "Moderate"
                              ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                              : "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                          }`}
                        >
                          {severity}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t-2 border-blue-200 animate-fadeInUp">
                        <div>
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                            <span>🛠️</span>
                            Fix Method
                          </label>
                          <select
                            className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white hover:border-blue-400"
                            value={settings.method}
                            onChange={(e) =>
                              updateColumnSetting(col, "method", e.target.value)
                            }
                          >
                            {METHOD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                            <span>🎚️</span>
                            Threshold (0.1 – 1.0)
                          </label>
                          <input
                            type="number"
                            min={0.1}
                            max={1}
                            step={0.1}
                            className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all hover:border-blue-400"
                            value={settings.threshold}
                            onChange={(e) =>
                              updateColumnSetting(
                                col,
                                "threshold",
                                e.target.value
                              )
                            }
                            placeholder="0.5"
                          />
                          <p className="mt-2 text-xs text-slate-600 flex items-center gap-1">
                            <span>💡</span>
                            Target ratio for minority class
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {categorical.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-8 animate-fadeIn">
            <span className="text-3xl mb-2 block">📭</span>
            No categorical columns available
          </div>
        )}
      </div>

      {/* Apply Button */}
      {!hideApplyButton && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={!canApply}
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-4 text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 disabled:hover:scale-100 animate-pulseGlow"
          >
            {loading ? (
              <>
                <Spinner />
                <span className="ml-2">Applying fixes...</span>
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

      {/* Categorical Columns Modal for SMOTE */}
      <CategoricalColumnsModal
        isOpen={showCategoricalModal}
        onClose={() => setShowCategoricalModal(false)}
        onConfirm={handleCategoricalModalConfirm}
        allColumns={columns}
        targetColumn={currentColumn}
      />

      {/* Loading State */}
      {loading && (
        <div className="my-6 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 animate-pulseGlow">
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-lg font-bold text-blue-800 animate-pulse">
              Applying bias correction...
            </p>
            <p className="text-sm text-slate-600">
              This may take a moment. Please wait.
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
                Bias Correction Applied Successfully!
                <span className="text-green-600">✓</span>
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Your dataset has been corrected and balanced
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-white rounded-xl border-2 border-green-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💾</span>
              <span className="font-bold text-slate-700">
                Corrected File Saved:
              </span>
            </div>
            <div className="font-mono text-blue-600 text-sm break-all bg-blue-50 p-3 rounded-lg border border-blue-200">
              {result.corrected_file_path || "N/A"}
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
                      <span>🏷️</span>
                      Class
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>📉</span>
                      Before
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>📈</span>
                      After
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>🛠️</span>
                      Method
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>🎯</span>
                      Threshold
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(() => {
                  const rows = [];
                  const columns = result.columns || {};

                  Object.entries(columns).forEach(([colName, colData]) => {
                    const beforeDist = colData?.before?.distribution || {};
                    const afterDist = colData?.after?.distribution || {};
                    const classes = Object.keys(beforeDist).filter(
                      (k) => k !== "severity" && k !== "note"
                    );

                    if (classes.length === 0) return;

                    classes.forEach((className, idx) => {
                      const beforeValue =
                        beforeDist[className] !== null &&
                        beforeDist[className] !== undefined
                          ? Number(beforeDist[className]).toFixed(2)
                          : "N/A";
                      const afterValue =
                        afterDist[className] !== null &&
                        afterDist[className] !== undefined
                          ? Number(afterDist[className]).toFixed(2)
                          : "N/A";

                      rows.push(
                        <tr
                          key={`${colName}-${className}`}
                          className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 animate-fadeInUp"
                          style={{ animationDelay: `${rows.length * 0.03}s` }}
                        >
                          {idx === 0 && (
                            <td
                              rowSpan={classes.length}
                              className="px-6 py-4 text-sm font-bold text-slate-900 align-top border-r-2 border-slate-200 bg-slate-50"
                            >
                              {colName}
                            </td>
                          )}
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">
                            <span className="px-3 py-1 bg-slate-100 rounded-full">
                              {className}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-red-600">
                            <span className="px-3 py-1 bg-red-50 rounded-lg border border-red-200">
                              {beforeValue}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-green-600">
                            <span className="px-3 py-1 bg-green-50 rounded-lg border-2 border-green-300 shadow-sm">
                              {afterValue}
                            </span>
                          </td>
                          {idx === 0 && (
                            <>
                              <td
                                rowSpan={classes.length}
                                className="px-6 py-4 text-sm font-semibold text-blue-700 align-top"
                              >
                                <span className="px-3 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg border border-blue-300 inline-block">
                                  {METHOD_OPTIONS.find(
                                    (m) => m.value === colData?.method
                                  )?.label ||
                                    colData?.method ||
                                    "N/A"}
                                </span>
                              </td>
                              <td
                                rowSpan={classes.length}
                                className="px-6 py-4 text-sm font-bold text-slate-700 align-top"
                              >
                                <span className="px-3 py-2 bg-purple-100 rounded-lg border border-purple-300 inline-block">
                                  {colData?.threshold || "N/A"}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    });
                  });

                  return rows;
                })()}
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
                      Distribution values closer to equal proportions indicate
                      reduced bias
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
