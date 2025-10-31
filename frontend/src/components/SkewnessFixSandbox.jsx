import { useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const FIX_SKEW_URL = "http://localhost:5000/fix_skew";

export default function SkewnessFixSandbox({
  filePath,
  continuous = [],
  skewnessResults = {},
}) {
  const [selectedColumns, setSelectedColumns] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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

      // Extract filename from path
      const filenameOnly = filePath.includes("/")
        ? filePath.split("/").pop()
        : filePath;

      const payload = {
        filename: filenameOnly,
        columns: Array.from(selectedColumns),
      };

      const res = await axios.post(FIX_SKEW_URL, payload, {
        headers: { "Content-Type": "application/json" },
      });

      setResult(res.data || {});
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
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Skewness Fix Sandbox</h2>
          <p className="text-xs text-slate-600 mt-1">
            Apply transformations to reduce skewness in continuous columns
          </p>
        </div>
      </div>

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
              Select All Skewed
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {continuous.map((col) => {
            const skew = skewnessResults[col]?.skewness;
            const method = getMethodForSkewness(skew);
            const isSkewed =
              skew !== null && skew !== undefined && Math.abs(skew) > 0.5;

            return (
              <label
                key={col}
                className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  selectedColumns.has(col)
                    ? "bg-blue-50 border-blue-300"
                    : isSkewed
                    ? "bg-white border-slate-300 hover:bg-slate-50"
                    : "bg-slate-50 border-slate-200 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedColumns.has(col)}
                  onChange={() => toggleColumn(col)}
                  disabled={!isSkewed}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800">
                    {col}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    Skewness:{" "}
                    {skew !== null && skew !== undefined
                      ? skew.toFixed(3)
                      : "N/A"}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Method: {method}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {continuous.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-4">
            No continuous columns available
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={applyFix}
          disabled={!canApply}
          className="inline-flex items-center rounded-md bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Spinner />
              <span className="ml-2">Applying Transformations...</span>
            </>
          ) : (
            `Apply Fix to ${selectedColumns.size} Column${
              selectedColumns.size !== 1 ? "s" : ""
            }`
          )}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="my-4">
          <Spinner text="Applying skewness corrections..." />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="my-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Results Display */}
      {!loading && result && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="text-lg font-semibold text-green-800 mb-3">
            ✓ Transformation Results
          </h3>

          <div className="mb-3 text-sm">
            <span className="font-medium text-slate-700">
              Corrected file saved:{" "}
            </span>
            <span className="font-mono text-blue-600">
              {result.corrected_file}
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
                    Original Skewness
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    New Skewness
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-600">
                    Method Applied
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(result.transformations || {}).map(
                  ([col, info]) => (
                    <tr key={col} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-sm font-medium text-slate-800">
                        {col}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {info.error ? (
                          <span className="text-red-600">{info.error}</span>
                        ) : info.original_skewness !== null ? (
                          info.original_skewness.toFixed(3)
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {info.error ? (
                          "-"
                        ) : info.new_skewness !== null ? (
                          <span
                            className={
                              Math.abs(info.new_skewness) <= 0.5
                                ? "text-green-600 font-semibold"
                                : ""
                            }
                          >
                            {info.new_skewness.toFixed(3)}
                          </span>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-blue-600">
                        {info.error ? "-" : info.method}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-slate-600">
            <strong>Note:</strong> The corrected dataset has been saved.
            Skewness values closer to 0 indicate more symmetric distributions.
          </div>
        </div>
      )}
    </div>
  );
}
