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
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoricalResults, setCategoricalResults] = useState(null); // { [column]: { class: proportion, ..., severity } }
  const [skewnessResults, setSkewnessResults] = useState(null); // { [column]: { skewness, n_nonnull, interpretation } }

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
    const keys = Object.keys(skewnessResults);
    const order = (continuous && continuous.length ? continuous : keys).filter(
      (k) => keys.includes(k)
    );
    return order.map((k) => [k, skewnessResults[k]]);
  }, [skewnessResults, continuous]);

  const hasIssues = useMemo(() => {
    if (!categoricalResults) return false;
    return Object.values(categoricalResults).some((v) =>
      ["Moderate", "Severe"].includes(v?.severity)
    );
  }, [categoricalResults]);

  const getSkewnessInterpretation = (skewness) => {
    if (skewness === null || skewness === undefined) {
      return { label: "N/A", color: "text-gray-500" };
    }
    if (skewness > 0.5) {
      return { label: "Right-skewed", color: "text-orange-600" };
    }
    if (skewness < -0.5) {
      return { label: "Left-skewed", color: "text-blue-600" };
    }
    return { label: "Symmetric", color: "text-green-600" };
  };

  const runDetection = async () => {
    setError("");
    setCategoricalResults(null);
    setSkewnessResults(null);

    if (!filePath) {
      setError("No file selected. Please upload a dataset first.");
      return;
    }

    const hasCategorical = categorical && categorical.length > 0;
    const hasContinuous = continuous && continuous.length > 0;

    if (!hasCategorical && !hasContinuous) {
      setError("No columns selected for bias detection.");
      return;
    }

    try {
      setLoading(true);

      // Extract filename from path
      const filenameOnly = filePath.includes("/")
        ? filePath.split("/").pop()
        : filePath;

      // Run categorical bias detection
      if (hasCategorical) {
        const catRes = await axios.post(
          DETECT_BIAS_URL,
          { file_path: filePath, categorical },
          { headers: { "Content-Type": "application/json" } }
        );
        setCategoricalResults(catRes.data || {});
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
        const skewResults = {};
        skewResponses.forEach(({ column, data, error }) => {
          if (error) {
            skewResults[column] = { error, skewness: null, n_nonnull: 0 };
          } else {
            skewResults[column] = data;
          }
        });
        setSkewnessResults(skewResults);
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
    if (sev === "Severe") return "bg-red-100";
    if (sev === "Moderate") return "bg-yellow-100";
    return "";
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
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bias Detection</h2>
        <div className="text-xs text-slate-500">
          File: <span className="font-mono">{filePath || "(none)"}</span>
        </div>
      </div>

      <p className="text-sm text-slate-600 mb-4">
        Analyze class imbalance in categorical columns and skewness in
        continuous columns.
      </p>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={runDetection}
          disabled={loading || !filePath || (!hasCategorical && !hasContinuous)}
        >
          {loading ? "Analyzing..." : "Run Bias Detection"}
        </button>

        {hasIssues && categoricalResults && (
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
            onClick={() => onFix?.({ results: categoricalResults })}
          >
            Fix Categorical Bias
          </button>
        )}

        {skewnessResults && hasContinuous && (
          <button
            type="button"
            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            onClick={() => onSkewFix?.({ skewnessResults })}
          >
            Fix Skewness
          </button>
        )}
      </div>

      {loading && (
        <div className="my-3">
          <Spinner text="Evaluating bias and skewness..." />
        </div>
      )}

      {error && (
        <div className="my-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Categorical Bias Results */}
      {!loading && categoricalResults && hasCategorical && (
        <div className="mb-6">
          <h3 className="text-md font-semibold text-slate-800 mb-2">
            Categorical Columns (Class Imbalance)
          </h3>
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
                {orderedCategoricalEntries.map(([col, info]) => (
                  <tr
                    key={col}
                    className={`hover:bg-slate-50 ${classNameForSeverity(
                      info?.severity
                    )}`}
                  >
                    <td className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">
                      {col}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-700">
                      {formatDistribution(info)}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-slate-800">
                      {info?.severity || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Continuous Skewness Results */}
      {!loading && skewnessResults && hasContinuous && (
        <div>
          <h3 className="text-md font-semibold text-slate-800 mb-2">
            Continuous Columns (Skewness)
          </h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full table-auto">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                    Column Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                    Skewness Value
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                    Non-null Count
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-600 border-b">
                    Interpretation
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderedSkewnessEntries.map(([col, info]) => {
                  const interpretation = getSkewnessInterpretation(
                    info?.skewness
                  );
                  return (
                    <tr key={col} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-sm text-slate-700 whitespace-nowrap">
                        {col}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-800 font-mono">
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
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {info?.n_nonnull || 0}
                      </td>
                      <td
                        className={`px-4 py-2 text-sm font-medium ${interpretation.color}`}
                      >
                        {info?.error ? "-" : interpretation.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-500 bg-slate-50 p-3 rounded">
            <strong>Note:</strong> Skewness &gt; 0.5 = Right-skewed, &lt; -0.5 =
            Left-skewed, -0.5 to 0.5 = Symmetric
          </div>
        </div>
      )}
    </div>
  );
}
