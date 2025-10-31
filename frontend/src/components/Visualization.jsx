import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const VIS_BIAS_URL = "http://localhost:5000/visualize_bias";
const VIS_SKEW_URL = "http://localhost:5000/visualize_skew";

export default function Visualization({
  beforePath,
  afterPath,
  targetColumn,
  mode = "categorical", // "categorical" or "continuous"
  continuous = [], // array of continuous column names
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [beforeB64, setBeforeB64] = useState("");
  const [afterB64, setAfterB64] = useState("");
  const [skewCharts, setSkewCharts] = useState({}); // For continuous: { column: { before_chart, after_chart, ... } }

  const canRunCategorical = Boolean(
    beforePath && afterPath && targetColumn && mode === "categorical"
  );
  const canRunContinuous = Boolean(
    beforePath && afterPath && continuous.length > 0 && mode === "continuous"
  );

  useEffect(() => {
    let cancelled = false;

    async function runCategorical() {
      if (!canRunCategorical) return;
      setLoading(true);
      setError("");
      setBeforeB64("");
      setAfterB64("");
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
        setBeforeB64(res?.data?.before_chart || "");
        setAfterB64(res?.data?.after_chart || "");
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
      setBeforeB64("");
      setAfterB64("");
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
    continuous,
    mode,
    canRunCategorical,
    canRunContinuous,
  ]);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === "categorical"
              ? "Categorical Bias Visualization"
              : "Skewness Visualization"}
          </h2>
          {mode === "categorical" && (
            <div className="text-xs text-slate-500 mt-1">
              Target:{" "}
              <span className="font-mono">{targetColumn || "(none)"}</span>
            </div>
          )}
          {mode === "continuous" && (
            <div className="text-xs text-slate-500 mt-1">
              Columns:{" "}
              <span className="font-mono">
                {continuous.join(", ") || "(none)"}
              </span>
            </div>
          )}
        </div>
      </div>

      {!canRunCategorical && mode === "categorical" && (
        <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
          Provide before and after paths plus a target column to visualize
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

      {/* Categorical Visualization */}
      {!loading &&
        !error &&
        mode === "categorical" &&
        beforeB64 &&
        afterB64 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="font-medium text-slate-700 mb-2">
                Before Correction
              </h3>
              <img
                src={`data:image/png;base64,${beforeB64}`}
                alt="Before class distribution"
                className="w-full h-auto rounded-md"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="font-medium text-slate-700 mb-2">
                After Correction
              </h3>
              <img
                src={`data:image/png;base64,${afterB64}`}
                alt="After class distribution"
                className="w-full h-auto rounded-md"
              />
            </div>
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

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 text-sm">
                        Before Transformation
                      </h4>
                      <img
                        src={`data:image/png;base64,${data.before_chart}`}
                        alt={`Before distribution of ${col}`}
                        className="w-full h-auto rounded-md border border-slate-200"
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-700 mb-2 text-sm">
                        After Transformation
                      </h4>
                      <img
                        src={`data:image/png;base64,${data.after_chart}`}
                        alt={`After distribution of ${col}`}
                        className="w-full h-auto rounded-md border border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
