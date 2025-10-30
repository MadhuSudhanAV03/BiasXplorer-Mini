import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const DETECT_URL = "http://localhost:5000/detect_bias";

export default function BiasDetection({ filePath, categorical = [], onFix }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null); // { [column]: { class: proportion, ..., severity } }

  const orderedEntries = useMemo(() => {
    if (!results) return [];
    // Respect provided categorical order where possible
    const keys = Object.keys(results);
    const order = (categorical && categorical.length ? categorical : keys).filter((k) => keys.includes(k));
    return order.map((k) => [k, results[k]]);
  }, [results, categorical]);

  const hasIssues = useMemo(() => {
    if (!results) return false;
    return Object.values(results).some((v) => ["Moderate", "Severe"].includes(v?.severity));
  }, [results]);

  const runDetection = async () => {
    setError("");
    setResults(null);
    if (!filePath) {
      setError("No file selected. Please upload a dataset first.");
      return;
    }
    if (!categorical || categorical.length === 0) {
      setError("No categorical columns provided.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post(
        DETECT_URL,
        { file_path: filePath, categorical },
        { headers: { "Content-Type": "application/json" } }
      );
      setResults(res.data || {});
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || "Bias detection failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const classNameForSeverity = (sev) => {
    if (sev === "Severe") return "bg-red-100";
    if (sev === "Moderate") return "bg-yellow-100";
    return "";
  };

  const formatDistribution = (obj) => {
    if (!obj) return "-";
    const entries = Object.entries(obj).filter(([k]) => k !== "severity" && k !== "note");
    if (entries.length === 0) return obj.note ? obj.note : "-";
    return entries
      .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`)
      .join(", ");
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bias Detection</h2>
        <div className="text-xs text-slate-500">
          File: <span className="font-mono">{filePath || "(none)"}</span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={runDetection}
          disabled={loading || !filePath || !categorical.length}
        >
          {loading ? "Analyzing..." : "Run Bias Detection"}
        </button>

        {hasIssues && results && (
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
            onClick={() => onFix?.({ results })}
          >
            Fix Bias
          </button>
        )}
      </div>

      {loading && (
        <div className="my-3">
          <Spinner text="Evaluating class imbalance..." />
        </div>
      )}

      {error && (
        <div className="my-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {!loading && results && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full table-auto">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                  Column Name
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                  Class Distribution
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                  Severity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orderedEntries.map(([col, info]) => (
                <tr key={col} className={`hover:bg-slate-50 ${classNameForSeverity(info?.severity)}`}>
                  <td className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">{col}</td>
                  <td className="px-4 py-2 text-sm text-slate-700">{formatDistribution(info)}</td>
                  <td className="px-4 py-2 text-sm font-medium text-slate-800">{info?.severity || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
