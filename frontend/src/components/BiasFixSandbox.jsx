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
  onApplyFix,
  onStateChange,
}) {
  const [selectedColumns, setSelectedColumns] = useState(
    new Set(initialSelectedColumns)
  );
  const [columnSettings, setColumnSettings] = useState({}); // { colName: { method, threshold } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showCategoricalModal, setShowCategoricalModal] = useState(false);
  const [currentColumn, setCurrentColumn] = useState(null); // For SMOTE modal

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
      setResult({
        columns: allResults,
        corrected_file_path: currentFilePath,
      });

      if (currentFilePath) {
        onFixComplete?.(currentFilePath);
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
      <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Select Columns to Fix
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Select All Imbalanced
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs px-3 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {categorical.map((col) => {
            const severity = biasResults[col]?.severity;
            const hasIssue = severity === "Moderate" || severity === "Severe";
            const isSelected = selectedColumns.has(col);
            const settings = columnSettings[col] || {
              method: "oversample",
              threshold: 0.5,
            };

            return (
              <div
                key={col}
                className={`p-4 rounded border transition-colors ${
                  isSelected
                    ? "bg-blue-50 border-blue-300"
                    : hasIssue
                    ? "bg-white border-slate-300"
                    : "bg-slate-50 border-slate-200 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleColumn(col)}
                    disabled={!hasIssue}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium text-sm text-slate-800">
                          {col}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Distribution: {getDistributionText(col)}
                        </div>
                      </div>
                      {severity && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            severity === "Severe"
                              ? "bg-red-100 text-red-700"
                              : severity === "Moderate"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {severity}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Method
                          </label>
                          <select
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
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
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Threshold (0.1 – 1.0)
                          </label>
                          <input
                            type="number"
                            min={0.1}
                            max={1}
                            step={0.1}
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
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
                          <p className="mt-1 text-xs text-slate-500">
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
          <div className="text-sm text-slate-500 text-center py-4">
            No categorical columns available
          </div>
        )}
      </div>

      {/* Apply Button */}
      {!hideApplyButton && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleApplyClick}
            disabled={!canApply}
            className="inline-flex items-center rounded-md bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Spinner />
                <span className="ml-2">Applying...</span>
              </>
            ) : (
              `Apply Fix to ${selectedColumns.size} Column${
                selectedColumns.size !== 1 ? "s" : ""
              }`
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
        <div className="my-4">
          <Spinner text="Applying bias correction..." />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="my-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Results Display */}
      {!loading && result && !hideResults && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-3">
            ✓ Bias Correction Applied
          </h3>

          <div className="mb-3 text-sm">
            <span className="font-medium text-slate-700">
              Corrected file saved:{" "}
            </span>
            <span className="font-mono text-blue-600">
              {result.corrected_file_path || "N/A"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-auto bg-white rounded-lg">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    Column
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    Class
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    Before Distribution
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    After Distribution
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    Method Applied
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    Threshold
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
                      rows.push(
                        <tr
                          key={`${colName}-${className}`}
                          className="hover:bg-slate-50"
                        >
                          {idx === 0 && (
                            <td
                              rowSpan={classes.length}
                              className="px-4 py-2 text-sm font-medium text-slate-800 align-top border-r border-slate-200"
                            >
                              {colName}
                            </td>
                          )}
                          <td className="px-4 py-2 text-sm text-slate-700">
                            {className}
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-600">
                            {beforeDist[className] !== null &&
                            beforeDist[className] !== undefined
                              ? Number(beforeDist[className]).toFixed(2)
                              : "N/A"}
                          </td>
                          <td className="px-4 py-2 text-sm font-semibold text-green-600">
                            {afterDist[className] !== null &&
                            afterDist[className] !== undefined
                              ? Number(afterDist[className]).toFixed(2)
                              : "N/A"}
                          </td>
                          {idx === 0 && (
                            <>
                              <td
                                rowSpan={classes.length}
                                className="px-4 py-2 text-sm text-blue-600 align-top"
                              >
                                {METHOD_OPTIONS.find(
                                  (m) => m.value === colData?.method
                                )?.label ||
                                  colData?.method ||
                                  "N/A"}
                              </td>
                              <td
                                rowSpan={classes.length}
                                className="px-4 py-2 text-sm text-slate-600 align-top"
                              >
                                {colData?.threshold || "N/A"}
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

          <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-slate-600">
            <strong>Note:</strong> The corrected dataset has been saved.
            Distribution values closer to equal proportions indicate reduced
            bias. View detailed visualizations in the Visualization section.
          </div>
        </div>
      )}
    </div>
  );
}
