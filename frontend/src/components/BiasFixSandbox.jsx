import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import Plot from "react-plotly.js";
import Spinner from "./Spinner";

const FIX_URL = "http://localhost:5000/api/bias/fix";

const METHOD_OPTIONS = [
  { label: "Oversample", value: "oversample" },
  { label: "Undersample", value: "undersample" },
  { label: "SMOTE", value: "smote" },
  { label: "Reweight", value: "reweight" },
];

export default function BiasFixSandbox({
  filePath,
  targetColumn,
  onFixComplete,
}) {
  const [method, setMethod] = useState("oversample");
  const [threshold, setThreshold] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // backend response
  const [correctedPath, setCorrectedPath] = useState("");

  // Clear results when target column changes
  useEffect(() => {
    console.log("[BiasFixSandbox] Target column changed to:", targetColumn);
    setResult(null);
    setCorrectedPath("");
    setError("");
  }, [targetColumn]);

  const beforeDist = result?.before?.distribution || {};
  const afterDist = result?.after?.distribution || {};

  const classes = useMemo(() => {
    const set = new Set([
      ...Object.keys(beforeDist),
      ...Object.keys(afterDist),
    ]);
    // Remove non-class keys if any slipped in
    set.delete("severity");
    set.delete("note");
    return Array.from(set).sort();
  }, [beforeDist, afterDist]);

  const beforeY = classes.map((k) => Number(beforeDist?.[k] ?? 0));
  const afterY = classes.map((k) => Number(afterDist?.[k] ?? 0));

  const canApply = filePath && targetColumn && method && !loading;

  const applyFix = async () => {
    setError("");
    setResult(null);
    setCorrectedPath("");
    if (!filePath) {
      setError("No file selected. Please upload/select a dataset first.");
      return;
    }
    if (!targetColumn) {
      setError("Please choose a target column to fix.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        file_path: filePath,
        target_column: String(targetColumn),
        method,
      };
      console.log(
        "[BiasFixSandbox] Sending fix request with payload:",
        payload
      );

      // Only include threshold if a number within (0,1]
      const thr = Number(threshold);
      if (!Number.isNaN(thr) && thr > 0 && thr <= 1) {
        payload.threshold = thr;
      }

      const res = await axios.post(FIX_URL, payload, {
        headers: { "Content-Type": "application/json" },
      });
      console.log(
        "[BiasFixSandbox] Fix response for",
        targetColumn,
        ":",
        res.data
      );
      setResult(res.data || {});
      const corrPath = res.data?.corrected_file_path;
      if (corrPath) {
        setCorrectedPath(corrPath);
        // Notify parent component that fix is complete
        onFixComplete?.(corrPath);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || "Bias fix failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bias Fix Sandbox</h2>
        <div className="text-xs text-slate-500">
          File: <span className="font-mono">{filePath || "(none)"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Method
          </label>
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Threshold (0.1 – 1.0)
          </label>
          <input
            type="number"
            min={0.1}
            max={1}
            step={0.1}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="0.5"
          />
          <p className="mt-1 text-xs text-slate-500">
            Used as target minority/majority ratio (binary classes). Ignored
            when not applicable.
          </p>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={applyFix}
            disabled={!canApply}
          >
            {loading ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading && (
        <div className="my-3">
          <Spinner text="Running bias correction..." />
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="font-medium text-slate-700 mb-2">
              Before ({targetColumn})
            </h3>
            <Plot
              data={[
                {
                  type: "bar",
                  x: classes,
                  y: beforeY,
                  marker: { color: "#94a3b8" },
                  name: "Before",
                },
              ]}
              layout={{
                autosize: true,
                margin: { l: 40, r: 10, t: 10, b: 40 },
                yaxis: { range: [0, 1], title: "Proportion" },
                xaxis: { title: "Class" },
              }}
              useResizeHandler
              style={{ width: "100%", height: "300px" }}
              config={{ displayModeBar: false }}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="font-medium text-slate-700 mb-2">
              After ({targetColumn})
            </h3>
            <Plot
              data={[
                {
                  type: "bar",
                  x: classes,
                  y: afterY,
                  marker: { color: "#60a5fa" },
                  name: "After",
                },
              ]}
              layout={{
                autosize: true,
                margin: { l: 40, r: 10, t: 10, b: 40 },
                yaxis: { range: [0, 1], title: "Proportion" },
                xaxis: { title: "Class" },
              }}
              useResizeHandler
              style={{ width: "100%", height: "300px" }}
              config={{ displayModeBar: false }}
            />
          </div>

          <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm text-slate-700">
              {correctedPath ? (
                <>
                  Corrected file saved at:{" "}
                  <span className="font-mono">{correctedPath}</span>
                </>
              ) : (
                <span className="text-slate-500">
                  Run correction to see the output path.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
