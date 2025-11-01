import { useMemo, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";

import { useMemo, useState } from "react";
import axios from "axios";

const REPORT_URL = "http://localhost:5000/api/reports/generate";

export default function ReportGenerator({
  biasSummary = {},
  correctionSummary = {},
  visualizations = {},
}) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [reportPath, setReportPath] = useState("");

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

  const generateAndDownload = async () => {
    setError("");
    setReportPath("");
    let path = "";
    try {
      setLoading(true);
      const payload = {
        bias_summary: biasSummary,
        correction_summary: correctionSummary,
        visualizations,
      };
      const res = await axios.post(REPORT_URL, payload, {
        headers: { "Content-Type": "application/json" },
      });
      path = res?.data?.report_path;
      if (!path) throw new Error("No report path returned by server");
      setReportPath(path);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        "Failed to generate report";
      setError(msg);
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }

    // Download step
    try {
      setDownloading(true);
      const relative = path.startsWith("/") ? path.substring(1) : path;
      if (!relative) throw new Error("Report path missing; cannot download.");
      const url = `http://localhost:5000/${relative}`;
      const fileRes = await axios.get(url, { responseType: "blob" });
      const blob = new Blob([fileRes.data], { type: "application/pdf" });
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
      setDownloading(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold mb-3">Report Generator</h2>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
          <div className="text-sm text-slate-700">Method: {method || "-"}</div>
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
          {hasCharts && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <img
                className="w-full rounded border border-slate-200"
                src={`data:image/png;base64,${visualizations.before_chart}`}
                alt="Before"
              />
              <img
                className="w-full rounded border border-slate-200"
                src={`data:image/png;base64,${visualizations.after_chart}`}
                alt="After"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={generateAndDownload}
          disabled={loading || downloading}
        >
          {loading || downloading ? "Preparing..." : "Download Report"}
        </button>
      </div>

      {(loading || downloading) && (
        <div className="mt-3">
          <Spinner
            text={loading ? "Generating report..." : "Downloading report..."}
          />
        </div>
      )}

      {reportPath && (
        <div className="mt-3 text-xs text-slate-500">
          Generated at: <span className="font-mono">{reportPath}</span>
        </div>
      )}
    </div>
  );
}
