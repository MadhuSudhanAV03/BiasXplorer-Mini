import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import axios from "axios";
import Spinner from "../components/Spinner";

export default function ReportPage() {
  const location = useLocation();
  const [reportPath, setReportPath] = useState("");
  const [biasSummary, setBiasSummary] = useState({});
  const [correctionSummary, setCorrectionSummary] = useState({});
  const [visualizations, setVisualizations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pull data from navigation state or fallback to localStorage (if you store it there)
  useEffect(() => {
    const state = location.state || {};
    const rp =
      state.reportPath ||
      window.localStorage.getItem("bx_lastReportPath") ||
      "";
    setReportPath(rp);
    if (state.biasSummary) setBiasSummary(state.biasSummary);
    if (state.correctionSummary) setCorrectionSummary(state.correctionSummary);
    if (state.visualizations) setVisualizations(state.visualizations);
  }, [location.state]);

  const biasCounts = useMemo(() => {
    const entries = Object.entries(biasSummary || {});
    const counts = {
      total: entries.length,
      Low: 0,
      Moderate: 0,
      Severe: 0,
      NA: 0,
    };
    for (const [, stats] of entries) {
      const sev = (stats && stats.severity) || "N/A";
      if (sev === "Low") counts.Low++;
      else if (sev === "Moderate") counts.Moderate++;
      else if (sev === "Severe") counts.Severe++;
      else counts.NA++;
    }
    return counts;
  }, [biasSummary]);

  const beforeTotal = correctionSummary?.before?.total ?? null;
  const afterTotal = correctionSummary?.after?.total ?? null;
  const method = correctionSummary?.method ?? null;
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
            <div className="text-sm text-slate-700">
              Columns: {biasCounts.total}
            </div>
            <div className="text-xs text-slate-600">Low: {biasCounts.Low}</div>
            <div className="text-xs text-amber-700">
              Moderate: {biasCounts.Moderate}
            </div>
            <div className="text-xs text-red-700">
              Severe: {biasCounts.Severe}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-700 mb-2">
              Correction Summary
            </h3>
            <div className="text-sm text-slate-700">
              Method: {method || "-"}
            </div>
            <div className="text-xs text-slate-600">
              Before total: {beforeTotal ?? "-"}
            </div>
            <div className="text-xs text-slate-600">
              After total: {afterTotal ?? "-"}
            </div>
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
              <p className="text-sm text-slate-600">
                PDF generated by the backend. Keep this for your records.
              </p>
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
      </main>
    </div>
  );
}
