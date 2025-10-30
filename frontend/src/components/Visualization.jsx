import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const VIS_URL = "http://localhost:5000/visualize_bias";

export default function Visualization({ beforePath, afterPath, targetColumn }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [beforeB64, setBeforeB64] = useState("");
  const [afterB64, setAfterB64] = useState("");

  const canRun = Boolean(beforePath && afterPath && targetColumn);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!canRun) return;
      setLoading(true);
      setError("");
      setBeforeB64("");
      setAfterB64("");
      try {
        const res = await axios.post(
          VIS_URL,
          { before_path: beforePath, after_path: afterPath, target_column: targetColumn },
          { headers: { "Content-Type": "application/json" } }
        );
        if (cancelled) return;
        setBeforeB64(res?.data?.before_chart || "");
        setAfterB64(res?.data?.after_chart || "");
      } catch (err) {
        if (cancelled) return;
        const msg = err?.response?.data?.error || err.message || "Visualization failed";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [beforePath, afterPath, targetColumn, canRun]);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bias Visualization</h2>
        <div className="text-xs text-slate-500">
          Target: <span className="font-mono">{targetColumn || "(none)"}</span>
        </div>
      </div>

      {!canRun && (
        <div className="mb-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
          Provide before and after paths plus a target column to visualize.
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

      {!loading && !error && beforeB64 && afterB64 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="font-medium text-slate-700 mb-2">Before</h3>
            <img
              src={`data:image/png;base64,${beforeB64}`}
              alt="Before class distribution"
              className="w-full h-auto rounded-md"
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="font-medium text-slate-700 mb-2">After</h3>
            <img
              src={`data:image/png;base64,${afterB64}`}
              alt="After class distribution"
              className="w-full h-auto rounded-md"
            />
          </div>
        </div>
      )}

      {/* Note: Backend returns pre-rendered charts as base64 PNGs. If you want interactive Plotly charts here, */}
      {/* extend backend to also return raw distributions, and plot them with react-plotly.js instead of images. */}
    </div>
  );
}
