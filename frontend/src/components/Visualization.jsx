import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Plot from "react-plotly.js";
import Spinner from "./Spinner";

const VIS_BIAS_URL = "http://localhost:5000/api/bias/visualize";
const VIS_SKEW_URL = "http://localhost:5000/api/skewness/visualize";

export default function Visualization({
  beforePath,
  afterPath,
  targetColumn, // For single categorical column (legacy)
  targetColumns = [], // For multiple categorical columns
  mode = "categorical", // "categorical", "categorical-multi", or "continuous"
  continuous = [], // array of continuous column names
  fixResults = null, // NEW: Pre-computed fix results with before/after statistics
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoricalCharts, setCategoricalCharts] = useState({}); // For categorical-multi: { column: { before_chart, after_chart } }
  const [skewCharts, setSkewCharts] = useState({}); // For continuous: { column: { before_chart, after_chart, ... } }

  // Memoize to prevent infinite loops
  const continuousStr = useMemo(() => JSON.stringify(continuous), [continuous]);
  const targetColumnsStr = useMemo(
    () => JSON.stringify(targetColumns),
    [targetColumns]
  );
  const fixResultsStr = useMemo(() => JSON.stringify(fixResults), [fixResults]);

  // Helper function to generate charts from fixResults (for categorical)
  const generateCategoricalChartsFromResults = (fixResults, columns) => {
    if (!fixResults || !fixResults.columns) return {};

    const charts = {};
    columns.forEach((col) => {
      const colData = fixResults.columns[col];
      if (!colData) return;

      const beforeDist = colData.before?.distribution || colData.before || {};
      const afterDist = colData.after?.distribution || colData.after || {};

      // Remove non-distribution keys
      const cleanBefore = { ...beforeDist };
      const cleanAfter = { ...afterDist };
      delete cleanBefore.severity;
      delete cleanBefore.note;
      delete cleanAfter.severity;
      delete cleanAfter.note;

      // Create chart data
      const categories = Object.keys(cleanBefore);
      const beforeValues = categories.map(
        (cat) => (cleanBefore[cat] || 0) * 100
      );
      const afterValues = categories.map((cat) => (cleanAfter[cat] || 0) * 100);

      charts[col] = {
        beforeData: { categories, values: beforeValues },
        afterData: { categories, values: afterValues },
      };
    });

    return charts;
  };

  // Helper function to generate charts from fixResults (for continuous)
  const generateContinuousChartsFromResults = (fixResults, columns) => {
    if (!fixResults || !fixResults.columns) return {};

    const charts = {};
    columns.forEach((col) => {
      const colData = fixResults.columns[col];
      if (!colData) return;

      charts[col] = {
        before_skewness: colData.before?.skewness,
        after_skewness: colData.after?.skewness,
        method: colData.method,
      };
    });

    return charts;
  };

  const canRunCategorical = useMemo(
    () =>
      Boolean(
        beforePath && afterPath && targetColumn && mode === "categorical"
      ),
    [beforePath, afterPath, targetColumn, mode]
  );

  const canRunCategoricalMulti = useMemo(
    () =>
      Boolean(
        beforePath &&
          afterPath &&
          targetColumns.length > 0 &&
          mode === "categorical-multi"
      ),
    [beforePath, afterPath, targetColumns, mode]
  );

  const canRunContinuous = useMemo(
    () =>
      Boolean(
        beforePath &&
          afterPath &&
          continuous.length > 0 &&
          mode === "continuous"
      ),
    [beforePath, afterPath, continuous, mode]
  );

  useEffect(() => {
    let cancelled = false;

    // NEW: If fixResults are provided, use them instead of calling backend
    if (
      fixResults &&
      mode === "categorical-multi" &&
      targetColumns.length > 0
    ) {
      console.log(
        "[Visualization] Using fixResults instead of backend:",
        fixResults
      );
      const charts = generateCategoricalChartsFromResults(
        fixResults,
        targetColumns
      );
      setCategoricalCharts(charts);
      setLoading(false);
      return;
    }

    if (fixResults && mode === "continuous" && continuous.length > 0) {
      console.log(
        "[Visualization] Using fixResults for continuous:",
        fixResults
      );
      const charts = generateContinuousChartsFromResults(
        fixResults,
        continuous
      );
      setSkewCharts(charts);
      setLoading(false);
      return;
    }

    async function runCategorical() {
      if (!canRunCategorical) return;
      setLoading(true);
      setError("");
      setCategoricalCharts({});
      setSkewCharts({});

      try {
        const res = await axios.post(
          VIS_BIAS_URL,
          {
            before_path: beforePath,
            after_path: afterPath,
            target_column: targetColumn,
          },
          { headers: { "Content-Type": "application/json" } }
        );
        if (cancelled) return;
        // Store in categorical charts format for consistency
        setCategoricalCharts({
          [targetColumn]: {
            before_chart: res?.data?.before_chart || "",
            after_chart: res?.data?.after_chart || "",
          },
        });
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.error ||
          err.message ||
          "Categorical visualization failed";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function runCategoricalMulti() {
      if (!canRunCategoricalMulti) return;
      console.log("[Visualization] Running categorical-multi mode with:", {
        beforePath,
        afterPath,
        targetColumns,
      });
      setLoading(true);
      setError("");
      setCategoricalCharts({});
      setSkewCharts({});

      try {
        const charts = {};
        // Fetch visualization for each categorical column
        for (const col of targetColumns) {
          try {
            const res = await axios.post(
              VIS_BIAS_URL,
              {
                before_path: beforePath,
                after_path: afterPath,
                target_column: col,
              },
              { headers: { "Content-Type": "application/json" } }
            );
            if (cancelled) return;
            charts[col] = {
              before_chart: res?.data?.before_chart || "",
              after_chart: res?.data?.after_chart || "",
            };
          } catch (err) {
            console.error(`[Visualization] Error for column ${col}:`, err);
            charts[col] = {
              error:
                err?.response?.data?.error ||
                err.message ||
                "Visualization failed",
            };
          }
        }
        if (!cancelled) {
          setCategoricalCharts(charts);
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.error ||
          err.message ||
          "Categorical visualization failed";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function runContinuous() {
      if (!canRunContinuous) return;
      console.log("[Visualization] Running continuous mode with:", {
        beforePath,
        afterPath,
        continuous,
      });
      setLoading(true);
      setError("");
      setCategoricalCharts({});
      setSkewCharts({});

      try {
        const res = await axios.post(
          VIS_SKEW_URL,
          {
            before_path: beforePath,
            after_path: afterPath,
            columns: continuous,
          },
          { headers: { "Content-Type": "application/json" } }
        );
        if (cancelled) return;
        console.log(
          "[Visualization] Received skewness charts:",
          res?.data?.charts
        );
        setSkewCharts(res?.data?.charts || {});
      } catch (err) {
        if (cancelled) return;
        console.error("[Visualization] Skewness visualization error:", err);
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err.message ||
          "Skewness visualization failed";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (mode === "categorical") {
      runCategorical();
    } else if (mode === "categorical-multi") {
      runCategoricalMulti();
    } else if (mode === "continuous") {
      runContinuous();
    }

    return () => {
      cancelled = true;
    };
  }, [
    beforePath,
    afterPath,
    targetColumn,
    targetColumnsStr,
    continuousStr,
    mode,
    fixResultsStr,
  ]);

  return (
    <div className="w-full">
      {!canRunCategorical &&
        !canRunCategoricalMulti &&
        !canRunContinuous &&
        mode === "categorical" && (
          <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
            Provide before and after paths plus a target column to visualize
            categorical bias.
          </div>
        )}

      {!canRunCategoricalMulti && mode === "categorical-multi" && (
        <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
          Provide before and after paths plus target columns to visualize
          categorical bias.
        </div>
      )}

      {!canRunContinuous && mode === "continuous" && (
        <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
          Provide before and after paths plus continuous columns to visualize
          skewness.
        </div>
      )}

      {loading && (
        <div className="my-3">
          <Spinner text="Generating charts..." />
        </div>
      )}

      {error && (
        <div className="my-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Categorical Visualization - Single or Multi */}
      {!loading &&
        !error &&
        (mode === "categorical" || mode === "categorical-multi") &&
        Object.keys(categoricalCharts).length > 0 && (
          <div className="space-y-6">
            {Object.entries(categoricalCharts).map(([col, data]) => {
              if (data.error) {
                return (
                  <div
                    key={col}
                    className="rounded-lg border border-red-200 bg-red-50 p-4"
                  >
                    <h3 className="font-semibold text-red-800 mb-1">{col}</h3>
                    <p className="text-sm text-red-600">{data.error}</p>
                  </div>
                );
              }

              return (
                <div
                  key={col}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {col}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 text-sm">
                        Before Correction
                      </h4>
                      <div className="rounded-md border border-slate-200 bg-white">
                        {data.before_chart ? (
                          // Backend-generated chart (base64)
                          <Plot
                            data={JSON.parse(data.before_chart).data}
                            layout={{
                              ...JSON.parse(data.before_chart).layout,
                              autosize: true,
                            }}
                            config={{ responsive: true, displayModeBar: true }}
                            style={{ width: "100%", height: "100%" }}
                            useResizeHandler={true}
                          />
                        ) : data.beforeData ? (
                          // Client-generated chart from fixResults
                          <Plot
                            data={[
                              {
                                x: data.beforeData.categories,
                                y: data.beforeData.values.map((v) => v / 100),
                                type: "bar",
                                text: data.beforeData.values.map(
                                  (v) => `${v.toFixed(2)}%`
                                ),
                                textposition: "outside",
                                marker: {
                                  color: "#4C78A8",
                                  line: { color: "#2C5282", width: 1 },
                                },
                                hovertemplate:
                                  "<b>%{x}</b><br>Proportion: %{y:.2%}<br><extra></extra>",
                              },
                            ]}
                            layout={{
                              title: {
                                text: `Before: ${col}`,
                                font: { size: 16, weight: "bold" },
                                xref: "paper",
                                x: 0,
                                xanchor: "left",
                                pad: { l: -2 },
                              },
                              xaxis_title: "Class",
                              yaxis_title: "Proportion",
                              yaxis: { range: [0, 1], tickformat: ".0%" },
                              plot_bgcolor: "white",
                              height: 400,
                              margin: { l: 50, r: 50, t: 60, b: 50 },
                              hovermode: "closest",
                              xaxis: {
                                showgrid: true,
                                gridwidth: 1,
                                gridcolor: "#E2E8F0",
                              },
                            }}
                            config={{ responsive: true, displayModeBar: true }}
                            style={{ width: "100%", height: "400px" }}
                            useResizeHandler={true}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 text-sm">
                        After Correction
                      </h4>
                      <div className="rounded-md border border-slate-200 bg-white">
                        {data.after_chart ? (
                          // Backend-generated chart (base64)
                          <Plot
                            data={JSON.parse(data.after_chart).data}
                            layout={{
                              ...JSON.parse(data.after_chart).layout,
                              autosize: true,
                            }}
                            config={{ responsive: true, displayModeBar: true }}
                            style={{ width: "100%", height: "100%" }}
                            useResizeHandler={true}
                          />
                        ) : data.afterData ? (
                          // Client-generated chart from fixResults
                          <Plot
                            data={[
                              {
                                x: data.afterData.categories,
                                y: data.afterData.values.map((v) => v / 100),
                                type: "bar",
                                text: data.afterData.values.map(
                                  (v) => `${v.toFixed(2)}%`
                                ),
                                textposition: "outside",
                                marker: {
                                  color: "#4C78A8",
                                  line: { color: "#2C5282", width: 1 },
                                },
                                hovertemplate:
                                  "<b>%{x}</b><br>Proportion: %{y:.2%}<br><extra></extra>",
                              },
                            ]}
                            layout={{
                              title: {
                                text: `After: ${col}`,
                                font: { size: 16, weight: "bold" },
                                xref: "paper",
                                x: 0,
                                xanchor: "left",
                                pad: { l: -2 },
                              },
                              xaxis_title: "Class",
                              yaxis_title: "Proportion",
                              yaxis: { range: [0, 1], tickformat: ".0%" },
                              plot_bgcolor: "white",
                              height: 400,
                              margin: { l: 50, r: 50, t: 60, b: 50 },
                              hovermode: "closest",
                              xaxis: {
                                showgrid: true,
                                gridwidth: 1,
                                gridcolor: "#E2E8F0",
                              },
                            }}
                            config={{ responsive: true, displayModeBar: true }}
                            style={{ width: "100%", height: "400px" }}
                            useResizeHandler={true}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Continuous Visualization */}
      {!loading &&
        !error &&
        mode === "continuous" &&
        Object.keys(skewCharts).length === 0 && (
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 border border-blue-200">
            No skewness charts available. Make sure you have fixed skewed
            columns first.
          </div>
        )}

      {!loading &&
        !error &&
        mode === "continuous" &&
        Object.keys(skewCharts).length > 0 && (
          <div className="space-y-6">
            {Object.entries(skewCharts).map(([col, data]) => {
              if (data.error) {
                return (
                  <div
                    key={col}
                    className="rounded-lg border border-red-200 bg-red-50 p-4"
                  >
                    <h3 className="font-semibold text-red-800 mb-1">{col}</h3>
                    <p className="text-sm text-red-600">{data.error}</p>
                  </div>
                );
              }

              return (
                <div
                  key={col}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-slate-800">
                      {col}
                    </h3>
                    <div className="flex gap-4 text-sm text-slate-600 mt-1">
                      <span>
                        Before Skewness:{" "}
                        <strong className="text-slate-800">
                          {data.before_skewness?.toFixed(3) || "N/A"}
                        </strong>
                      </span>
                      <span>→</span>
                      <span>
                        After Skewness:{" "}
                        <strong
                          className={
                            Math.abs(data.after_skewness || 0) <= 0.5
                              ? "text-green-600"
                              : "text-slate-800"
                          }
                        >
                          {data.after_skewness?.toFixed(3) || "N/A"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {data.before_chart && data.after_chart ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-slate-700 mb-2 text-sm">
                          Before Transformation
                        </h4>
                        <div className="rounded-md border border-slate-200 bg-white">
                          <Plot
                            data={JSON.parse(data.before_chart).data}
                            layout={{
                              ...JSON.parse(data.before_chart).layout,
                              autosize: true,
                            }}
                            config={{ responsive: true, displayModeBar: true }}
                            style={{ width: "100%", height: "100%" }}
                            useResizeHandler={true}
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-700 mb-2 text-sm">
                          After Transformation
                        </h4>
                        <div className="rounded-md border border-slate-200 bg-white">
                          <Plot
                            data={JSON.parse(data.after_chart).data}
                            layout={{
                              ...JSON.parse(data.after_chart).layout,
                              autosize: true,
                            }}
                            config={{ responsive: true, displayModeBar: true }}
                            style={{ width: "100%", height: "100%" }}
                            useResizeHandler={true}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 border border-blue-200">
                      <p className="font-semibold mb-1">Skewness Values:</p>
                      <p>
                        The skewness has been reduced from{" "}
                        <strong>{data.before_skewness?.toFixed(3)}</strong> to{" "}
                        <strong>{data.after_skewness?.toFixed(3)}</strong> using
                        the <strong>{data.method}</strong> method.
                      </p>
                      <p className="text-xs mt-2 text-blue-600">
                        💡 Distribution histograms are computed from the actual
                        files during backend processing.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
