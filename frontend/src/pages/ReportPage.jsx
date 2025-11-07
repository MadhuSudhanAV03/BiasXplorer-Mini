import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import axios from "axios";
import Plot from "react-plotly.js";
import Plotly from "plotly.js-dist";
import Spinner from "../components/Spinner";
import html2pdf from "html2pdf.js";

export default function ReportPage() {
  const location = useLocation();
  const mainRef = useRef(null);
  const [reportPath, setReportPath] = useState("");
  const [correctedPath, setCorrectedPath] = useState("");
  const [correctionSummary, setCorrectionSummary] = useState({});
  // Note: previously accepted visualizations via navigation state; now fetched on-demand
  const [vizLoading, setVizLoading] = useState(false);
  const [vizError, setVizError] = useState("");
  const [vizCategorical, setVizCategorical] = useState({}); // { col: { before_chart, after_chart } }
  const [vizContinuous, setVizContinuous] = useState({}); // { col: { before_chart, after_chart, before_skewness, after_skewness } }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storageTick, setStorageTick] = useState(0);

  // Helpers: Safe localStorage getter with JSON.parse fallback
  const getStorageValue = (key, defaultValue = "") => {
    try {
      const value = window.localStorage.getItem(key);
      if (value == null) return defaultValue;
      // Attempt JSON.parse; if it fails, return raw string
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch {
      return defaultValue;
    }
  };

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
      getStorageValue("bx_lastReportPath") ||
      "";
    setReportPath(rp);
    if (state.correctionSummary) setCorrectionSummary(state.correctionSummary);
    if (!state.correctionSummary) {
      try {
        const storedCorr = getStorageValue("dashboard_reportCorrectionSummary");
        if (storedCorr && typeof storedCorr === 'object') {
          setCorrectionSummary(storedCorr);
        }
      } catch (e) {
        // ignore malformed JSON
        console.warn("Failed to parse stored correction summary:", e);
      }
    }
  // Visualizations will be fetched on-demand below; no longer pulled from navigation state

    // Try to pick corrected dataset path from navigation state first, then localStorage persisted by Dashboard
    const cpFromState =
      state.correctedPath || state?.correctionSummary?.corrected_file_path;
    // Use safe getter for persisted value which may be JSON-serialized
    const cpFromStorage = getStorageValue("dashboard_correctedFilePath");
    setCorrectedPath(cpFromState || cpFromStorage || "");
  }, [location.state]);

  // Live-refresh when Dashboard updates persisted summaries/paths
  useEffect(() => {
    const onStorage = (e) => {
      try {
        if (e.key === "dashboard_reportCorrectionSummary" && e.newValue) {
          const parsed = getStorageValue(e.key);
          if (parsed && typeof parsed === 'object') {
            setCorrectionSummary(parsed);
          }
        }
        if (e.key === "dashboard_correctedFilePath") {
          const parsed = getStorageValue(e.key);
          setCorrectedPath(parsed || "");
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
      const selected = getStorageValue("dashboard_selectedColumns", []);
      const categoricalCols = getStorageValue("dashboard_categorical", []);
      const continuousCols = getStorageValue("dashboard_continuous", []);
      const biasDet = getStorageValue("dashboard_biasResults", {});
      const skewDet = getStorageValue("dashboard_skewnessResults", {});
      
      // Ensure arrays
      const selectedArr = Array.isArray(selected) ? selected : [];
      const catColsArr = Array.isArray(categoricalCols) ? categoricalCols : [];
      const contColsArr = Array.isArray(continuousCols) ? continuousCols : [];
      const biasDetObj = typeof biasDet === 'object' && biasDet !== null ? biasDet : {};
      const skewDetObj = typeof skewDet === 'object' && skewDet !== null ? skewDet : {};
      
      // Use unique selections and only count those that belong to either categorical or continuous targets
      const uniqSelected = Array.from(new Set(selectedArr));
      const selectedInScope = uniqSelected.filter(
        (c) => catColsArr.includes(c) || contColsArr.includes(c)
      );
      const counts = { 
        totalSelectedAll: selectedInScope.length, 
        Low: 0, 
        Moderate: 0, 
        Severe: 0, 
        NotTested: 0,
        LowCols: [],
        ModerateCols: [],
        SevereCols: [],
        NotTestedCols: []
      };
      // Categorical severities only for categorical selections
      for (const col of selectedInScope.filter((c) => catColsArr.includes(c))) {
        const sev = biasDetObj?.[col]?.severity;
        if (sev === "Low") {
          counts.Low++;
          counts.LowCols.push(col);
        } else if (sev === "Moderate") {
          counts.Moderate++;
          counts.ModerateCols.push(col);
        } else if (sev === "Severe") {
          counts.Severe++;
          counts.SevereCols.push(col);
        } else {
          counts.NotTested++;
          counts.NotTestedCols.push(col);
        }
      }
      // Continuous skewness classes
      const contCounts = { 
        right: 0, 
        left: 0, 
        normal: 0, 
        notTested: 0,
        rightCols: [],
        leftCols: [],
        normalCols: [],
        notTestedCols: []
      };
      const classify = (v) => {
        if (v === null || v === undefined || Number.isNaN(Number(v))) return "notTested";
        const sk = Number(v);
        if (Math.abs(sk) <= 0.1) return "normal"; // tolerance band for near-normal
        return sk > 0 ? "right" : "left";
      };
      for (const col of selectedInScope.filter((c) => contColsArr.includes(c))) {
        const cat = classify(skewDetObj?.[col]?.skewness);
        contCounts[cat]++;
        contCounts[cat + 'Cols'].push(col);
      }

      return { ...counts, continuous: contCounts };
    } catch {
      return { 
        totalSelectedAll: 0, 
        Low: 0, 
        Moderate: 0, 
        Severe: 0, 
        NotTested: 0,
        LowCols: [],
        ModerateCols: [],
        SevereCols: [],
        NotTestedCols: [],
        continuous: { 
          right: 0, 
          left: 0, 
          normal: 0, 
          notTested: 0,
          rightCols: [],
          leftCols: [],
          normalCols: [],
          notTestedCols: []
        } 
      };
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

  // Compute column details for Correction Summary display
  const correctionColumnDetails = useMemo(() => {
    try {
      const selected = getStorageValue("dashboard_selectedColumns", []);
      const biasResultsStored = getStorageValue("dashboard_biasResults", {});
      const skewnessResultsStored = getStorageValue("dashboard_skewnessResults", {});
      const categoricalCols = getStorageValue("dashboard_categorical", []);
      const continuousCols = getStorageValue("dashboard_continuous", []);

      const selectedArr = Array.isArray(selected) ? selected : [];
      const catColsArr = Array.isArray(categoricalCols) ? categoricalCols : [];
      const contColsArr = Array.isArray(continuousCols) ? continuousCols : [];
      const biasResultsObj = typeof biasResultsStored === 'object' && biasResultsStored !== null ? biasResultsStored : {};
      const skewnessResultsObj = typeof skewnessResultsStored === 'object' && skewnessResultsStored !== null ? skewnessResultsStored : {};

      const uniqSelected = Array.from(new Set(selectedArr));

      // Get categorical columns needing fix
      const catNeedingFix = catColsArr.filter((col) => {
        const sev = biasResultsObj?.[col]?.severity;
        return sev === "Moderate" || sev === "Severe";
      });

      // Get continuous columns needing fix
      const contNeedingFix = contColsArr.filter((col) => {
        const sk = skewnessResultsObj?.[col]?.skewness;
        return sk !== null && sk !== undefined && Math.abs(sk) > 0.5;
      });

      // Get selected columns for each type
      const catSelected = uniqSelected.filter((c) => catColsArr.includes(c));
      const contSelected = uniqSelected.filter((c) => contColsArr.includes(c));

      return {
        categorical: {
          selected: catSelected,
          needingFix: catNeedingFix,
          fixed: Object.keys(latestCategorical)
        },
        continuous: {
          selected: contSelected,
          needingFix: contNeedingFix,
          fixed: Object.keys(latestContinuous)
        }
      };
    } catch (e) {
      console.warn("Failed to compute correction column details:", e);
      return {
        categorical: { selected: [], needingFix: [], fixed: [] },
        continuous: { selected: [], needingFix: [], fixed: [] }
      };
    }
  }, [latestCategorical, latestContinuous]);

  // Fallbacks to compute counts if meta is not available
  const [fallbackCounts, setFallbackCounts] = useState({
    categorical: { total_selected: null, needing_fix: null, fixed: null },
    continuous: { total_selected: null, needing_fix: null, fixed: null },
  });

  useEffect(() => {
    if (metaCounts?.categorical && metaCounts?.continuous) return;

    try {
      // Total selected should reflect Target Column Selection (Step 3)
      const selected = getStorageValue("dashboard_selectedColumns", []);
      const biasResultsStored = getStorageValue("dashboard_biasResults", {});
      const skewnessResultsStored = getStorageValue("dashboard_skewnessResults", {});
      const categoricalCols = getStorageValue("dashboard_categorical", []);
      const continuousCols = getStorageValue("dashboard_continuous", []);

      // Ensure arrays and objects
      const selectedArr = Array.isArray(selected) ? selected : [];
      const catColsArr = Array.isArray(categoricalCols) ? categoricalCols : [];
      const contColsArr = Array.isArray(continuousCols) ? continuousCols : [];
      const biasResultsObj = typeof biasResultsStored === 'object' && biasResultsStored !== null ? biasResultsStored : {};
      const skewnessResultsObj = typeof skewnessResultsStored === 'object' && skewnessResultsStored !== null ? skewnessResultsStored : {};

      const uniqSelected = Array.from(new Set(selectedArr));

      const catNeeding = catColsArr.filter((col) => {
        const sev = biasResultsObj?.[col]?.severity;
        return sev === "Moderate" || sev === "Severe";
      }).length;
      const contNeeding = contColsArr.filter((col) => {
        const sk = skewnessResultsObj?.[col]?.skewness;
        return sk !== null && sk !== undefined && Math.abs(sk) > 0.5;
      }).length;

      setFallbackCounts({
        categorical: {
          total_selected: uniqSelected.filter((c) => catColsArr.includes(c)).length,
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
  // legacy indicator (unused now that we render fetched charts)
  // const hasCharts = Boolean(
  //   visualizations?.before_chart && visualizations?.after_chart
  // );

  // Auto-build visualizations for the latest fixed columns using persisted paths
  useEffect(() => {
    // Determine paths from storage (same precedence as Dashboard)
    const beforePath =
      getStorageValue("dashboard_beforeFixFilePath", "") ||
      getStorageValue("dashboard_cleanedFilePath", "") ||
      getStorageValue("dashboard_selectedFilePath", "") ||
      getStorageValue("dashboard_filePath", "") ||
      "";
    const afterPath = correctedPath;
    const catCols = Object.keys(latestCategorical || {});
    const contCols = Object.keys(latestContinuous || {});

    if (!afterPath || (!catCols.length && !contCols.length)) {
      setVizCategorical({});
      setVizContinuous({});
      return;
    }

    let cancelled = false;
    async function run() {
      try {
        setVizLoading(true);
        setVizError("");

        // Fetch categorical charts for each column (parallel)
        if (catCols.length) {
          const requests = catCols.map((col) =>
            axios
              .post(
                "http://localhost:5000/api/bias/visualize",
                {
                  before_path: beforePath,
                  after_path: afterPath,
                  target_column: col,
                },
                { headers: { "Content-Type": "application/json" } }
              )
              .then((res) => ({ col, data: res.data }))
              .catch((err) => ({ col, error: err }))
          );
          const results = await Promise.all(requests);
          if (!cancelled) {
            const out = {};
            results.forEach((r) => {
              if (r.error) {
                out[r.col] = { error: r.error?.response?.data?.error || r.error.message || "Failed" };
              } else {
                out[r.col] = {
                  before_chart: r.data?.before_chart || "",
                  after_chart: r.data?.after_chart || "",
                };
              }
            });
            setVizCategorical(out);
          }
        } else {
          setVizCategorical({});
        }

        // Fetch continuous charts (single request supports multiple columns)
        if (contCols.length) {
          const res = await axios.post(
            "http://localhost:5000/api/skewness/visualize",
            { before_path: beforePath, after_path: afterPath, columns: contCols },
            { headers: { "Content-Type": "application/json" } }
          );
          if (!cancelled) {
            setVizContinuous(res?.data?.charts || {});
          }
        } else {
          setVizContinuous({});
        }
      } catch (e) {
        if (!cancelled) setVizError(e?.response?.data?.error || e.message || "Failed to load visualizations");
      } finally {
        if (!cancelled) setVizLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [correctedPath, latestCategorical, latestContinuous]);

  const downloadReport = async () => {
    setError("");
    const node = mainRef.current;
    if (!node) return;
    try {
      setLoading(true);
      
      // Convert all Plotly charts to static images first
      const plotlyDivs = node.querySelectorAll('.js-plotly-plot');
      const plotlyImages = new Map();
      
      for (const plotDiv of plotlyDivs) {
        try {
          // Convert Plotly chart to high-quality PNG
          const imgData = await Plotly.toImage(plotDiv, {
            format: 'png',
            width: 800,
            height: 500,
            scale: 3
          });
          
          // Store the image data
          plotlyImages.set(plotDiv, imgData);
          
          // Replace the Plotly div with an img tag temporarily
          const img = document.createElement('img');
          img.src = imgData;
          img.style.width = '100%';
          img.style.height = 'auto';
          img.className = 'plotly-static-image';
          plotDiv.style.display = 'none';
          plotDiv.parentNode.insertBefore(img, plotDiv);
        } catch (err) {
          console.warn('Failed to convert chart to image:', err);
        }
      }
      
      // Apply export class
      node.classList.add("exporting");
      
      // Force compute all styles and replace oklch with rgb
      const elementsWithStyle = node.querySelectorAll('*');
      const originalStyles = new Map();
      
      elementsWithStyle.forEach(el => {
        const computed = window.getComputedStyle(el);
        const bgcolor = computed.backgroundColor;
        const color = computed.color;
        const borderColor = computed.borderColor;
        
        // Store original inline styles
        originalStyles.set(el, {
          backgroundColor: el.style.backgroundColor,
          color: el.style.color,
          borderColor: el.style.borderColor,
        });
        
        // If oklch detected, force RGB override
        if (bgcolor && bgcolor.includes('oklch')) {
          el.style.backgroundColor = '#ffffff';
        }
        if (color && color.includes('oklch')) {
          el.style.color = '#0f172a';
        }
        if (borderColor && borderColor.includes('oklch')) {
          el.style.borderColor = '#e2e8f0';
        }
      });
      
      const opt = {
        margin: [10, 10],
        filename: "biasxplorer_report.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: 1200,
          logging: false,
          allowTaint: true,
        },
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'], 
          before: '.avoid-break-before',
          after: '.avoid-break-after',
          avoid: ['table', 'tr', '.avoid-break', '.plotly-static-image'] 
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      
      await html2pdf().set(opt).from(node).save();
      
      // Restore original styles
      elementsWithStyle.forEach(el => {
        const original = originalStyles.get(el);
        if (original) {
          el.style.backgroundColor = original.backgroundColor;
          el.style.color = original.color;
          el.style.borderColor = original.borderColor;
        }
      });
      
      // Remove static images and restore Plotly charts
      const staticImages = node.querySelectorAll('.plotly-static-image');
      staticImages.forEach(img => img.remove());
      plotlyDivs.forEach(plotDiv => {
        plotDiv.style.display = '';
      });
      
    } catch (err) {
      console.error('PDF generation error:', err);
      setError(err?.message || "Failed to generate PDF");
    } finally {
      node.classList.remove("exporting");
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

  // Helper function to format column names display
  const formatColumns = (cols) => {
    if (!cols || cols.length === 0) return "";
    return ` (${cols.join(", ")})`;
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

  <main ref={mainRef} className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

  {/* Summary grid: Bias + Correction only */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-medium text-slate-700 mb-2">Bias Summary</h3>
            <div className="text-sm text-slate-700 mb-1">
              Columns fixed: {totalFixedCount}{formatColumns(Object.keys(latestCategorical).concat(Object.keys(latestContinuous)))}
            </div>
            <div className="text-sm text-slate-700 mb-2">
              Total columns selected: {biasSeverityCounts.totalSelectedAll}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-700">Categorical</div>
            <div className="text-xs text-green-700">
              Low: {biasSeverityCounts.Low}{formatColumns(biasSeverityCounts.LowCols)}
            </div>
            <div className="text-xs text-amber-900">
              Moderate: {biasSeverityCounts.Moderate}{formatColumns(biasSeverityCounts.ModerateCols)}
            </div>
            <div className="text-xs text-red-900">
              Severe: {biasSeverityCounts.Severe}{formatColumns(biasSeverityCounts.SevereCols)}
            </div>
            <div className="text-xs text-slate-500 mb-2">
              Not tested: {biasSeverityCounts.NotTested}{formatColumns(biasSeverityCounts.NotTestedCols)}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-700">Continuous</div>
            <div className="text-xs text-blue-900">
              Right skew: {biasSeverityCounts.continuous?.right ?? 0}{formatColumns(biasSeverityCounts.continuous?.rightCols)}
            </div>
            <div className="text-xs text-indigo-900">
              Left skew: {biasSeverityCounts.continuous?.left ?? 0}{formatColumns(biasSeverityCounts.continuous?.leftCols)}
            </div>
            <div className="text-xs text-emerald-800">
              Approximately normal: {biasSeverityCounts.continuous?.normal ?? 0}{formatColumns(biasSeverityCounts.continuous?.normalCols)}
            </div>
            <div className="text-xs text-slate-500">
              Not tested: {biasSeverityCounts.continuous?.notTested ?? 0}{formatColumns(biasSeverityCounts.continuous?.notTestedCols)}
            </div>
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
                <div className="text-xs text-amber-900">
                  Total selected: {metaCounts?.categorical?.total_selected ?? fallbackCounts.categorical.total_selected ?? "-"}
                  {formatColumns(correctionColumnDetails.categorical.selected)}
                </div>
                <div className="text-xs text-amber-900">
                  Needing fix: {metaCounts?.categorical?.needing_fix ?? fallbackCounts.categorical.needing_fix ?? "-"}
                  {formatColumns(correctionColumnDetails.categorical.needingFix)}
                </div>
                <div className="text-xs text-amber-900">
                  Fixed: {Object.keys(latestCategorical).length}
                  {formatColumns(correctionColumnDetails.categorical.fixed)}
                </div>
              </div>
              <div className="rounded border border-blue-200 bg-blue-50 p-3">
                <div className="text-sm font-semibold text-blue-900 mb-1">
                  Continuous
                </div>
                <div className="text-xs text-blue-900">
                  Total selected: {metaCounts?.continuous?.total_selected ?? fallbackCounts.continuous.total_selected ?? "-"}
                  {formatColumns(correctionColumnDetails.continuous.selected)}
                </div>
                <div className="text-xs text-blue-900">
                  Needing fix: {metaCounts?.continuous?.needing_fix ?? fallbackCounts.continuous.needing_fix ?? "-"}
                  {formatColumns(correctionColumnDetails.continuous.needingFix)}
                </div>
                <div className="text-xs text-blue-900">
                  Fixed: {Object.keys(latestContinuous).length}
                  {formatColumns(correctionColumnDetails.continuous.fixed)}
                </div>
              </div>
            </div>
            {(legacyMethod || legacyBeforeTotal || legacyAfterTotal) && (
              <div className="mt-2 text-xs text-slate-500">
                Legacy summary — Method: {legacyMethod || "-"}; Before: {legacyBeforeTotal ?? "-"}; After: {legacyAfterTotal ?? "-"}
              </div>
            )}
          </div>
          
        </div>

        {/* Visualizations Section - full width, placed below summaries */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Visualizations</h3>
          {vizError && (
            <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{vizError}</div>
          )}
          {vizLoading && (
            <div className="my-2">
              <Spinner text="Loading visualizations..." />
            </div>
          )}
          {!vizLoading && !vizError && (
            <>
              {Object.keys(vizCategorical).length === 0 && Object.keys(vizContinuous).length === 0 ? (
                <div className="text-sm text-slate-700">No visualizations available. Generate corrections first.</div>
              ) : (
                <div className="space-y-8">
                  {/* Categorical */}
                  {Object.keys(vizCategorical).length > 0 && (
                    <div className="avoid-break">
                      <h4 className="font-semibold text-slate-800 mb-3">Categorical Bias</h4>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(vizCategorical).map(([col, data]) => (
                          <div key={`cat-${col}`} className="rounded-md border border-slate-200 bg-white p-3 avoid-break">
                            <div className="mb-2 text-sm font-semibold text-slate-700">{col}</div>
                            {data.error ? (
                              <div className="text-sm text-red-700">{data.error}</div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 avoid-break">
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">Before</div>
                                  {data.before_chart && (
                                    <Plot
                                      className="w-full overflow-hidden"
                                      data={JSON.parse(data.before_chart).data}
                                      layout={{
                                        ...JSON.parse(data.before_chart).layout,
                                        autosize: true,
                                        height: 400,
                                        width: undefined,
                                        margin: { l: 50, r: 30, t: 30, b: 50 },
                                      }}
                                      config={{ responsive: true, displayModeBar: false }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">After</div>
                                  {data.after_chart && (
                                    <Plot
                                      className="w-full overflow-hidden"
                                      data={JSON.parse(data.after_chart).data}
                                      layout={{
                                        ...JSON.parse(data.after_chart).layout,
                                        autosize: true,
                                        height: 400,
                                        width: undefined,
                                        margin: { l: 50, r: 30, t: 30, b: 50 },
                                      }}
                                      config={{ responsive: true, displayModeBar: false }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Continuous */}
                  {Object.keys(vizContinuous).length > 0 && (
                    <div className="avoid-break">
                      <h4 className="font-semibold text-slate-800 mb-3">Continuous Skewness</h4>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(vizContinuous).map(([col, data]) => (
                          <div key={`cont-${col}`} className="rounded-md border border-slate-200 bg-white p-3 avoid-break">
                            <div className="mb-2 text-sm font-semibold text-slate-700">{col}</div>
                            {data.error ? (
                              <div className="text-sm text-red-700">{data.error}</div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 avoid-break">
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">Before</div>
                                  {data.before_chart && (
                                    <Plot
                                      className="w-full overflow-hidden"
                                      data={JSON.parse(data.before_chart).data}
                                      layout={{
                                        ...JSON.parse(data.before_chart).layout,
                                        autosize: true,
                                        height: 400,
                                        width: undefined,
                                        margin: { l: 50, r: 30, t: 30, b: 50 },
                                      }}
                                      config={{ responsive: true, displayModeBar: false }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">After</div>
                                  {data.after_chart && (
                                    <Plot
                                      className="w-full overflow-hidden"
                                      data={JSON.parse(data.after_chart).data}
                                      layout={{
                                        ...JSON.parse(data.after_chart).layout,
                                        autosize: true,
                                        height: 400,
                                        width: undefined,
                                        margin: { l: 50, r: 30, t: 30, b: 50 },
                                      }}
                                      config={{ responsive: true, displayModeBar: false }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Download Report - Hidden in PDF export */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hide-in-pdf">
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
                disabled={loading}
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
        </div>

  {/* Download Corrected Dataset - Hidden in PDF export */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm hide-in-pdf">
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
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 avoid-break">
                <h3 className="text-lg font-semibold text-amber-900 mb-4">
                  Categorical Corrections
                </h3>
                <div className="overflow-x-auto rounded-lg border border-amber-200 bg-white avoid-break">
                  <table className="min-w-full table-auto avoid-break">
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
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 avoid-break">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  Continuous Corrections
                </h3>
                <div className="overflow-x-auto rounded-lg border border-blue-200 bg-white avoid-break">
                  <table className="min-w-full table-auto avoid-break">
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
