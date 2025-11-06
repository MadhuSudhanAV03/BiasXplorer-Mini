import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import axios from "axios";
import Spinner from "../components/Spinner";

export default function ReportPage() {
  const location = useLocation();
  const [reportPath, setReportPath] = useState("");
  const [correctedPath, setCorrectedPath] = useState("");
  const [correctionSummary, setCorrectionSummary] = useState({});
  const [visualizations, setVisualizations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storageTick, setStorageTick] = useState(0);

  // Helpers
  const computeRatio = (distributionObj) => {
    try {
      if (!distributionObj || typeof distributionObj !== "object") return null;
      const values = Object.entries(distributionObj)
        .filter(([k]) => k !== "severity" && k !== "note" && k !== "total")
        .map(([, v]) => Number(v))
        .filter((v) => Number.isFinite(v));
      if (values.length < 2) return null;
      const maxV = Math.max(...values);
      const minV = Math.min(...values);
      if (maxV <= 0) return null;
      return Number((minV / maxV).toFixed(3));
    } catch {
      return null;
    }
  };

  // Pull data from navigation state or fallback to localStorage persisted by Dashboard
  useEffect(() => {
    const state = location.state || {};
    const rp =
      state.reportPath ||
      window.localStorage.getItem("bx_lastReportPath") ||
      "";
    setReportPath(rp);
    if (state.correctionSummary) setCorrectionSummary(state.correctionSummary);
    if (!state.correctionSummary) {
      try {
        const storedCorr = window.localStorage.getItem(
          "dashboard_reportCorrectionSummary"
        );
        if (storedCorr) setCorrectionSummary(JSON.parse(storedCorr));
      } catch (e) {
        // ignore malformed JSON
        console.warn("Failed to parse stored correction summary:", e);
      }
    }
    if (state.visualizations) setVisualizations(state.visualizations);

    // Try to pick corrected dataset path from navigation state first, then localStorage persisted by Dashboard
    const cpFromState =
      state.correctedPath || state?.correctionSummary?.corrected_file_path;
    const cpFromStorage = window.localStorage.getItem("dashboard_correctedFilePath");
    setCorrectedPath(cpFromState || cpFromStorage || "");
  }, [location.state]);

  // Live-refresh when Dashboard updates persisted summaries/paths
  useEffect(() => {
    const onStorage = (e) => {
      try {
        if (e.key === "dashboard_reportCorrectionSummary" && e.newValue) {
          setCorrectionSummary(JSON.parse(e.newValue));
        }
        if (e.key === "dashboard_correctedFilePath") {
          setCorrectedPath(e.newValue || "");
        }
        // Recompute severity counts when selection or detection results change
        if (
          e.key === "dashboard_selectedColumns" ||
          e.key === "dashboard_categorical" ||
          e.key === "dashboard_biasResults"
        ) {
          setStorageTick(Date.now());
        }
      } catch (err) {
        console.warn("Failed to parse storage update:", err);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Compute severity counts for categorical (Low/Moderate/Severe) and
  // skewness classes for continuous (Right/Left/Approximately normal).
  const biasSeverityCounts = useMemo(() => {
    // reference storageTick to satisfy exhaustive-deps while serving as an invalidation key
    void storageTick;
    try {
      const selected = JSON.parse(
        window.localStorage.getItem("dashboard_selectedColumns") || "[]"
      );
      const categoricalCols = JSON.parse(
        window.localStorage.getItem("dashboard_categorical") || "[]"
      );
      const continuousCols = JSON.parse(
        window.localStorage.getItem("dashboard_continuous") || "[]"
      );
      const biasDet = JSON.parse(
        window.localStorage.getItem("dashboard_biasResults") || "{}"
      );
      const skewDet = JSON.parse(
        window.localStorage.getItem("dashboard_skewnessResults") || "{}"
      );
      // Use unique selections and only count those that belong to either categorical or continuous targets
      const uniqSelected = Array.from(new Set(selected || []));
      const selectedInScope = uniqSelected.filter(
        (c) => (categoricalCols || []).includes(c) || (continuousCols || []).includes(c)
      );
      const counts = { totalSelectedAll: selectedInScope.length, Low: 0, Moderate: 0, Severe: 0, NotTested: 0 };
      // Categorical severities only for categorical selections
      for (const col of selectedInScope.filter((c) => (categoricalCols || []).includes(c))) {
        const sev = biasDet?.[col]?.severity;
        if (sev === "Low") counts.Low++;
        else if (sev === "Moderate") counts.Moderate++;
        else if (sev === "Severe") counts.Severe++;
        else counts.NotTested++;
      }
      // Continuous skewness classes
      const contCounts = { right: 0, left: 0, normal: 0, notTested: 0 };
      const classify = (v) => {
        if (v === null || v === undefined || Number.isNaN(Number(v))) return "notTested";
        const sk = Number(v);
        if (Math.abs(sk) <= 0.1) return "normal"; // tolerance band for near-normal
        return sk > 0 ? "right" : "left";
      };
      for (const col of selectedInScope.filter((c) => (continuousCols || []).includes(c))) {
        const cat = classify(skewDet?.[col]?.skewness);
        contCounts[cat]++;
      }

      return { ...counts, continuous: contCounts };
    } catch {
      return { totalSelectedAll: 0, Low: 0, Moderate: 0, Severe: 0, NotTested: 0, continuous: { right: 0, left: 0, normal: 0, notTested: 0 } };
    }
  }, [storageTick]);

  // Derive correction aggregates (support both new multi-column and legacy single-field shapes)
  const categoricalCorrections = useMemo(
    () => correctionSummary?.categorical || {},
    [correctionSummary?.categorical]
  );
  const continuousCorrections = useMemo(
    () => correctionSummary?.continuous || {},
    [correctionSummary?.continuous]
  );
  // Determine the most recent fix timestamp across all entries
  const latestTs = useMemo(() => {
    const tsValues = [];
    try {
      Object.values(categoricalCorrections || {}).forEach((info) => {
        const history = Array.isArray(info) ? info : [info];
        history.forEach((e) => {
          if (e && typeof e.ts === "number") tsValues.push(e.ts);
        });
      });
      Object.values(continuousCorrections || {}).forEach((info) => {
        const history = Array.isArray(info) ? info : [info];
        history.forEach((e) => {
          if (e && typeof e.ts === "number") tsValues.push(e.ts);
        });
      });
    } catch {
      // ignore
    }
    if (!tsValues.length) return null;
    return Math.max(...tsValues);
  }, [categoricalCorrections, continuousCorrections]);

  // Reduce to only the most recent run (latestTs); if no ts found, fall back to last entry per column
  const latestCategorical = useMemo(() => {
    const entries = Object.entries(categoricalCorrections || {});
    const out = {};
    entries.forEach(([col, info]) => {
      const history = Array.isArray(info) ? info : [info];
      if (latestTs) {
        const last = history.filter((e) => e && e.ts === latestTs).pop();
        if (last) out[col] = last;
      } else {
        out[col] = history[history.length - 1];
      }
    });
    return out;
  }, [categoricalCorrections, latestTs]);

  const latestContinuous = useMemo(() => {
    const entries = Object.entries(continuousCorrections || {});
    const out = {};
    entries.forEach(([col, info]) => {
      const history = Array.isArray(info) ? info : [info];
      if (latestTs) {
        const last = history.filter((e) => e && e.ts === latestTs).pop();
        if (last) out[col] = last;
      } else {
        out[col] = history[history.length - 1];
      }
    });
    return out;
  }, [continuousCorrections, latestTs]);
  // corrected file path intentionally not displayed; keep correctedPath only for download action
  const metaCounts = useMemo(() => correctionSummary?.meta || {}, [
    correctionSummary?.meta,
  ]);

  // Fixed counts derived from correction summary (both categorical and continuous)
  const fixedCategoricalCount = useMemo(() => {
    // show only latest run fixed columns
    return Object.keys(latestCategorical || {}).length;
  }, [latestCategorical]);

  const fixedContinuousCount = useMemo(() => {
    return Object.keys(latestContinuous || {}).length;
  }, [latestContinuous]);

  const totalFixedCount = useMemo(
    () => (fixedCategoricalCount || 0) + (fixedContinuousCount || 0),
    [fixedCategoricalCount, fixedContinuousCount]
  );
  const legacyBeforeTotal = correctionSummary?.before?.total ?? null;
  const legacyAfterTotal = correctionSummary?.after?.total ?? null;
  const legacyMethod = correctionSummary?.method ?? null;

  // Fallbacks to compute counts if meta is not available
  const [fallbackCounts, setFallbackCounts] = useState({
    categorical: { total_selected: null, needing_fix: null, fixed: null },
    continuous: { total_selected: null, needing_fix: null, fixed: null },
  });

  useEffect(() => {
    if (metaCounts?.categorical && metaCounts?.continuous) return;

    try {
      // Total selected should reflect Target Column Selection (Step 3)
      const selected = JSON.parse(
        window.localStorage.getItem("dashboard_selectedColumns") || "[]"
      );
      const uniqSelected = Array.from(new Set(selected || []));
      const biasResultsStored = JSON.parse(
        window.localStorage.getItem("dashboard_biasResults") || "{}"
      );
      const skewnessResultsStored = JSON.parse(
        window.localStorage.getItem("dashboard_skewnessResults") || "{}"
      );
      const categoricalCols = JSON.parse(
        window.localStorage.getItem("dashboard_categorical") || "[]"
      );
      const continuousCols = JSON.parse(
        window.localStorage.getItem("dashboard_continuous") || "[]"
      );

      const catNeeding = (categoricalCols || []).filter((col) => {
        const sev = biasResultsStored?.[col]?.severity;
        return sev === "Moderate" || sev === "Severe";
      }).length;
      const contNeeding = (continuousCols || []).filter((col) => {
        const sk = skewnessResultsStored?.[col]?.skewness;
        return sk !== null && sk !== undefined && Math.abs(sk) > 0.5;
      }).length;

      setFallbackCounts({
        categorical: {
          total_selected: uniqSelected.filter((c) => (categoricalCols || []).includes(c)).length,
          needing_fix: catNeeding,
          fixed: Object.keys(categoricalCorrections).length,
        },
        continuous: {
          total_selected: uniqSelected.filter((c) => (continuousCols || []).includes(c)).length,
          needing_fix: contNeeding,
          fixed: Object.keys(continuousCorrections).length,
        },
      });
    } catch (e) {
      console.warn("Failed to compute fallback counts:", e);
    }
  }, [metaCounts, categoricalCorrections, continuousCorrections]);
  const hasCharts = Boolean(
    visualizations?.before_chart && visualizations?.after_chart
  );

  const downloadReport = async () => {
    setError("");
    if (!reportPath) {
      setError("No report available. Generate one from the Dashboard.");
      return;
    }
    try {
      setLoading(true);
      const relative = reportPath.startsWith("/")
        ? reportPath.substring(1)
        : reportPath;
      const url = `http://localhost:5000/${relative}`;
      const res = await axios.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const a = document.createElement("a");
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      const fileName = relative.split("/").pop() || "biasxplorer_report.pdf";
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        "Failed to download report";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadCorrected = async () => {
    setError("");
    if (!correctedPath) {
      setError("No corrected dataset available. Apply a fix on the Dashboard first.");
      return;
    }
    try {
      setLoading(true);
      // Expect correctedPath like 'corrected/<filename>.csv'
      const filename = correctedPath.startsWith("corrected/")
        ? correctedPath.substring("corrected/".length)
        : correctedPath;
      const url = `http://localhost:5000/api/corrected/download/${encodeURIComponent(filename)}`;
      const res = await axios.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const a = document.createElement("a");
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.download = filename || "corrected_dataset.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || "Failed to download corrected dataset";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">
              Report
            </h1>
            <nav className="flex items-center gap-4">
              <Link
                to="/"
                className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

  <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* Summary grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-700 mb-2">Bias Summary</h3>
            <div className="text-sm text-slate-700 mb-1">Columns fixed: {totalFixedCount}</div>
            <div className="text-sm text-slate-700 mb-2">Total columns selected: {biasSeverityCounts.totalSelectedAll}</div>
            <div className="mt-1 text-xs font-semibold text-slate-700">Categorical</div>
            <div className="text-xs text-green-700">Low: {biasSeverityCounts.Low}</div>
            <div className="text-xs text-amber-900">Moderate: {biasSeverityCounts.Moderate}</div>
            <div className="text-xs text-red-900">Severe: {biasSeverityCounts.Severe}</div>
            <div className="text-xs text-slate-500 mb-2">Not tested: {biasSeverityCounts.NotTested}</div>
            <div className="mt-1 text-xs font-semibold text-slate-700">Continuous</div>
            <div className="text-xs text-blue-900">Right skew: {biasSeverityCounts.continuous?.right ?? 0}</div>
            <div className="text-xs text-indigo-900">Left skew: {biasSeverityCounts.continuous?.left ?? 0}</div>
            <div className="text-xs text-emerald-800">Approximately normal: {biasSeverityCounts.continuous?.normal ?? 0}</div>
            <div className="text-xs text-slate-500">Not tested: {biasSeverityCounts.continuous?.notTested ?? 0}</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-700 mb-2">
              Correction Summary
            </h3>
            {/* Corrected file path intentionally hidden as requested */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="rounded border border-amber-200 bg-amber-50 p-3">
                <div className="text-sm font-semibold text-amber-900 mb-1">
                  Categorical
                </div>
                <div className="text-xs text-amber-900">Total selected: {metaCounts?.categorical?.total_selected ?? fallbackCounts.categorical.total_selected ?? "-"}</div>
                <div className="text-xs text-amber-900">Needing fix: {metaCounts?.categorical?.needing_fix ?? fallbackCounts.categorical.needing_fix ?? "-"}</div>
                <div className="text-xs text-amber-900">Fixed: {Object.keys(latestCategorical).length}</div>
              </div>
              <div className="rounded border border-blue-200 bg-blue-50 p-3">
                <div className="text-sm font-semibold text-blue-900 mb-1">
                  Continuous
                </div>
                <div className="text-xs text-blue-900">Total selected: {metaCounts?.continuous?.total_selected ?? fallbackCounts.continuous.total_selected ?? "-"}</div>
                <div className="text-xs text-blue-900">Needing fix: {metaCounts?.continuous?.needing_fix ?? fallbackCounts.continuous.needing_fix ?? "-"}</div>
                <div className="text-xs text-blue-900">Fixed: {Object.keys(latestContinuous).length}</div>
              </div>
            </div>
            {(legacyMethod || legacyBeforeTotal || legacyAfterTotal) && (
              <div className="mt-2 text-xs text-slate-500">
                Legacy summary — Method: {legacyMethod || "-"}; Before: {legacyBeforeTotal ?? "-"}; After: {legacyAfterTotal ?? "-"}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-700 mb-2">Visualizations</h3>
            <div className="text-sm text-slate-700">
              Included: {hasCharts ? "Yes" : "No"}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Download Report
              </h2>
              <p className="text-sm text-slate-600">Keep this for your records.</p>
              {reportPath && (
                <p className="mt-2 text-xs text-slate-500">
                  Path: <span className="font-mono">{reportPath}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={downloadReport}
                disabled={!reportPath || loading}
              >
                {loading ? "Preparing..." : "Download PDF"}
              </button>
              {reportPath && (
                <a
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                  href={`http://localhost:5000/${
                    reportPath.startsWith("/")
                      ? reportPath.substring(1)
                      : reportPath
                  }`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in new tab
                </a>
              )}
            </div>
          </div>

          {loading && (
            <div className="mt-4">
              <Spinner text="Fetching report..." />
            </div>
          )}
        </div>

  {/* Download Corrected Dataset */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Download Corrected Dataset
              </h2>
              <p className="text-sm text-slate-600">
                CSV saved by the correction step. Use this for further analysis.
              </p>
              {/* Path intentionally hidden as requested */}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={downloadCorrected}
                disabled={!correctedPath || loading}
              >
                {loading ? "Preparing..." : "Download CSV"}
              </button>
            </div>
          </div>
        </div>

        {/* Visualization Previews (none on Report page; summary only) */}

        {/* Correction Details */}
        {(Object.keys(categoricalCorrections).length > 0 ||
          Object.keys(continuousCorrections).length > 0) && (
          <div className="mt-6 grid grid-cols-1 gap-6">
            {Object.keys(latestCategorical).length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h3 className="text-lg font-semibold text-amber-900 mb-4">
                  Categorical Corrections
                </h3>
                <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white">
                  <table className="min-w-full table-auto">
                    <thead className="bg-amber-100 text-amber-900 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Column</th>
                        <th className="px-4 py-3 text-left">Method</th>
                        <th className="px-4 py-3 text-left">Threshold</th>
                        <th className="px-4 py-3 text-left">Before Total</th>
                        <th className="px-4 py-3 text-left">After Total</th>
                        <th className="px-4 py-3 text-left">Before Ratio</th>
                        <th className="px-4 py-3 text-left">After Ratio</th>
                        <th className="px-4 py-3 text-left">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-sm">
                      {Object.entries(latestCategorical).map(([col, entry]) => {
                        return (
                          <tr key={`${col}-latest`} className="hover:bg-amber-50/60">
                            <td className="px-4 py-3 font-semibold">{col}</td>
                            <td className="px-4 py-3">{entry?.method || "-"}</td>
                            <td className="px-4 py-3">{entry?.threshold ?? "-"}</td>
                            <td className="px-4 py-3">{entry?.before?.total ?? "-"}</td>
                            <td className="px-4 py-3">{entry?.after?.total ?? "-"}</td>
                            <td className="px-4 py-3">{(() => { const r = computeRatio(entry?.before?.distribution || entry?.before); return r === null ? "-" : r; })()}</td>
                            <td className="px-4 py-3">{(() => { const r = computeRatio(entry?.after?.distribution || entry?.after); return r === null ? "-" : r; })()}</td>
                            <td className="px-4 py-3">{entry?.ts ? new Date(entry.ts).toLocaleString() : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {Object.keys(latestContinuous).length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  Continuous Corrections
                </h3>
                <div className="overflow-x-auto rounded-lg border border-blue-200 bg-white">
                  <table className="min-w-full table-auto">
                    <thead className="bg-blue-100 text-blue-900 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Column</th>
                        <th className="px-4 py-3 text-left">Before Skewness</th>
                        <th className="px-4 py-3 text-left">After Skewness</th>
                        <th className="px-4 py-3 text-left">Method</th>
                        <th className="px-4 py-3 text-left">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100 text-sm">
                      {Object.entries(latestContinuous).map(([col, entry]) => {
                        return (
                          <tr key={`${col}-latest`} className="hover:bg-blue-50/60">
                            <td className="px-4 py-3 font-semibold">{col}</td>
                            <td className="px-4 py-3">{entry?.original_skewness ?? "-"}</td>
                            <td className="px-4 py-3">{entry?.new_skewness ?? "-"}</td>
                            <td className="px-4 py-3">{entry?.method || "-"}</td>
                            <td className="px-4 py-3">{entry?.ts ? new Date(entry.ts).toLocaleString() : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
