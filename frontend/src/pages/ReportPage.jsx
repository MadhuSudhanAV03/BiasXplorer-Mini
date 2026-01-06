import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import axios from "axios";
import Plot from "react-plotly.js";
import Plotly from "plotly.js-dist-min";
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
    const rp = state.reportPath || getStorageValue("bx_lastReportPath") || "";
    setReportPath(rp);
    if (state.correctionSummary) setCorrectionSummary(state.correctionSummary);
    if (!state.correctionSummary) {
      try {
        const storedCorr = getStorageValue("dashboard_reportCorrectionSummary");
        if (storedCorr && typeof storedCorr === "object") {
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
          if (parsed && typeof parsed === "object") {
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
      const biasDetObj =
        typeof biasDet === "object" && biasDet !== null ? biasDet : {};
      const skewDetObj =
        typeof skewDet === "object" && skewDet !== null ? skewDet : {};

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
        NotTestedCols: [],
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
        notTestedCols: [],
      };
      const classify = (v) => {
        if (v === null || v === undefined || Number.isNaN(Number(v)))
          return "notTested";
        const sk = Number(v);
        if (Math.abs(sk) <= 0.1) return "normal"; // tolerance band for near-normal
        return sk > 0 ? "right" : "left";
      };
      for (const col of selectedInScope.filter((c) =>
        contColsArr.includes(c)
      )) {
        const cat = classify(skewDetObj?.[col]?.skewness);
        contCounts[cat]++;
        contCounts[cat + "Cols"].push(col);
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
          notTestedCols: [],
        },
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
  const metaCounts = useMemo(
    () => correctionSummary?.meta || {},
    [correctionSummary?.meta]
  );

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
      const skewnessResultsStored = getStorageValue(
        "dashboard_skewnessResults",
        {}
      );
      const categoricalCols = getStorageValue("dashboard_categorical", []);
      const continuousCols = getStorageValue("dashboard_continuous", []);

      const selectedArr = Array.isArray(selected) ? selected : [];
      const catColsArr = Array.isArray(categoricalCols) ? categoricalCols : [];
      const contColsArr = Array.isArray(continuousCols) ? continuousCols : [];
      const biasResultsObj =
        typeof biasResultsStored === "object" && biasResultsStored !== null
          ? biasResultsStored
          : {};
      const skewnessResultsObj =
        typeof skewnessResultsStored === "object" &&
        skewnessResultsStored !== null
          ? skewnessResultsStored
          : {};

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
          fixed: Object.keys(latestCategorical),
        },
        continuous: {
          selected: contSelected,
          needingFix: contNeedingFix,
          fixed: Object.keys(latestContinuous),
        },
      };
    } catch (e) {
      console.warn("Failed to compute correction column details:", e);
      return {
        categorical: { selected: [], needingFix: [], fixed: [] },
        continuous: { selected: [], needingFix: [], fixed: [] },
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
      const skewnessResultsStored = getStorageValue(
        "dashboard_skewnessResults",
        {}
      );
      const categoricalCols = getStorageValue("dashboard_categorical", []);
      const continuousCols = getStorageValue("dashboard_continuous", []);

      // Ensure arrays and objects
      const selectedArr = Array.isArray(selected) ? selected : [];
      const catColsArr = Array.isArray(categoricalCols) ? categoricalCols : [];
      const contColsArr = Array.isArray(continuousCols) ? continuousCols : [];
      const biasResultsObj =
        typeof biasResultsStored === "object" && biasResultsStored !== null
          ? biasResultsStored
          : {};
      const skewnessResultsObj =
        typeof skewnessResultsStored === "object" &&
        skewnessResultsStored !== null
          ? skewnessResultsStored
          : {};

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
          total_selected: uniqSelected.filter((c) => catColsArr.includes(c))
            .length,
          needing_fix: catNeeding,
          fixed: Object.keys(categoricalCorrections).length,
        },
        continuous: {
          total_selected: uniqSelected.filter((c) =>
            (continuousCols || []).includes(c)
          ).length,
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

  // Helper to generate client-side charts from fix results (same as Visualization.jsx)
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

  // Auto-build visualizations:
  // - Categorical: use stored fix results (from localStorage)
  // - Continuous: call backend API to recalculate from actual files
  useEffect(() => {
    // Get fix results from localStorage first
    const biasFixResult = getStorageValue("dashboard_biasFixResult", null);
    const skewnessFixResult = getStorageValue(
      "dashboard_skewnessFixResult",
      null
    );

    // Get columns from correction summary if available
    let catCols = Object.keys(latestCategorical || {});
    let contCols = Object.keys(latestContinuous || {});

    // Fallback: if correction summary is empty but fix results exist, use those
    if (!catCols.length && biasFixResult?.columns) {
      catCols = Object.keys(biasFixResult.columns);
      console.log(
        "[ReportPage] Using categorical columns from biasFixResult:",
        catCols
      );
    }
    if (!contCols.length && skewnessFixResult?.transformations) {
      contCols = Object.keys(skewnessFixResult.transformations);
      console.log(
        "[ReportPage] Using continuous columns from skewnessFixResult:",
        contCols
      );
    }

    // Filter out reweight columns from visualization (they show only statistics, no graphs)
    const nonReweightCatCols = catCols.filter((col) => {
      const colData = biasFixResult?.columns?.[col];
      return colData?.method !== "reweight";
    });

    if (!nonReweightCatCols.length && !contCols.length) {
      setVizCategorical({});
      setVizContinuous({});
      setVizLoading(false);
      return;
    }

    try {
      setVizLoading(true);
      setVizError("");

      // Generate categorical charts from stored results (excluding reweight)
      if (nonReweightCatCols.length && biasFixResult) {
        const catCharts = generateCategoricalChartsFromResults(
          biasFixResult,
          nonReweightCatCols
        );
        setVizCategorical(catCharts);
      } else {
        setVizCategorical({});
      }

      // For continuous/skewness, call backend API to recalculate from actual files
      if (contCols.length) {
        const workingPath = getStorageValue("dashboard_workingFilePath", "");
        const correctedFilePath =
          correctedPath || getStorageValue("dashboard_correctedFilePath", "");

        if (workingPath && correctedFilePath) {
          // Call backend to generate histogram+KDE charts
          axios
            .post(
              "http://localhost:5000/api/skewness/visualize",
              {
                before_path: workingPath,
                after_path: correctedFilePath,
                columns: contCols,
              },
              { headers: { "Content-Type": "application/json" } }
            )
            .then((res) => {
              setVizContinuous(res?.data?.charts || {});
              setVizLoading(false);
            })
            .catch((err) => {
              console.error("Failed to load continuous visualizations:", err);
              setVizError(
                err?.response?.data?.error ||
                  err.message ||
                  "Failed to load continuous visualizations"
              );
              setVizContinuous({});
              setVizLoading(false);
            });
        } else {
          console.warn("Missing paths for continuous visualization:", {
            workingPath,
            correctedFilePath,
          });
          setVizContinuous({});
          setVizLoading(false);
        }
      } else {
        setVizContinuous({});
        setVizLoading(false);
      }
    } catch (e) {
      setVizError(e.message || "Failed to load visualizations");
      setVizLoading(false);
    }
  }, [latestCategorical, latestContinuous, correctedPath]);

  const downloadReport = async () => {
    setError("");
    const node = mainRef.current;
    if (!node) return;
    try {
      setLoading(true);

      // Wait a moment for all charts to fully render
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Convert all Plotly charts to static images first
      const plotlyDivs = node.querySelectorAll(".js-plotly-plot");
      console.log(
        `[PDF Export] Found ${plotlyDivs.length} Plotly charts to convert`
      );
      const plotlyImages = new Map();

      for (const plotDiv of plotlyDivs) {
        try {
          // Convert Plotly chart to high-quality PNG
          const imgData = await Plotly.toImage(plotDiv, {
            format: "png",
            width: 800,
            height: 500,
            scale: 3,
          });

          console.log("[PDF Export] Successfully converted chart to image");

          // Store the image data
          plotlyImages.set(plotDiv, imgData);

          // Replace the Plotly div with an img tag temporarily
          const img = document.createElement("img");
          img.src = imgData;
          img.style.width = "100%";
          img.style.height = "auto";
          img.className = "plotly-static-image";
          plotDiv.style.display = "none";
          plotDiv.parentNode.insertBefore(img, plotDiv);
        } catch (err) {
          console.warn("Failed to convert chart to image:", err);
        }
      }

      // Apply export class
      node.classList.add("exporting");

      // Force compute all styles and replace oklch with rgb
      const elementsWithStyle = node.querySelectorAll("*");
      const originalStyles = new Map();

      elementsWithStyle.forEach((el) => {
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
        if (bgcolor && bgcolor.includes("oklch")) {
          el.style.backgroundColor = "#ffffff";
        }
        if (color && color.includes("oklch")) {
          el.style.color = "#0f172a";
        }
        if (borderColor && borderColor.includes("oklch")) {
          el.style.borderColor = "#e2e8f0";
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
          mode: ["avoid-all", "css", "legacy"],
          before: ".avoid-break-before",
          after: ".avoid-break-after",
          avoid: ["table", "tr", ".avoid-break", ".plotly-static-image"],
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(node).save();

      // Restore original styles
      elementsWithStyle.forEach((el) => {
        const original = originalStyles.get(el);
        if (original) {
          el.style.backgroundColor = original.backgroundColor;
          el.style.color = original.color;
          el.style.borderColor = original.borderColor;
        }
      });

      // Remove static images and restore Plotly charts
      const staticImages = node.querySelectorAll(".plotly-static-image");
      staticImages.forEach((img) => img.remove());
      plotlyDivs.forEach((plotDiv) => {
        plotDiv.style.display = "";
      });
    } catch (err) {
      console.error("PDF generation error:", err);
      setError(err?.message || "Failed to generate PDF");
    } finally {
      node.classList.remove("exporting");
      setLoading(false);
    }
  };

  const downloadCorrected = async () => {
    setError("");
    if (!correctedPath) {
      setError(
        "No corrected dataset available. Apply a fix on the Dashboard first."
      );
      return;
    }
    try {
      setLoading(true);
      // correctedPath is now like 'uploads/working_<filename>.csv'
      // Pass the full path to the backend
      const url = `http://localhost:5000/api/corrected/download/${encodeURIComponent(
        correctedPath
      )}`;
      const res = await axios.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const a = document.createElement("a");
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      // Extract just the filename for download
      const filename =
        correctedPath.split("/").pop() || "corrected_dataset.csv";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err.message ||
        "Failed to download corrected dataset";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const downloadWeights = () => {
    setError("");
    try {
      // Get biasFixResult from localStorage
      const biasFixResult = getStorageValue("dashboard_biasFixResult", null);
      if (!biasFixResult?.columns) {
        setError("No bias correction results found");
        return;
      }

      // Collect all reweight columns and their class weights
      const reweightData = {};
      Object.entries(biasFixResult.columns).forEach(([col, colData]) => {
        if (colData?.method === "reweight" && colData?.class_weights) {
          reweightData[col] = colData.class_weights;
        }
      });

      if (Object.keys(reweightData).length === 0) {
        setError("No reweight class weights found");
        return;
      }

      // Create JSON blob and download
      const jsonStr = JSON.stringify(reweightData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "class_weights.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message || "Failed to download class weights");
    }
  };

  // Helper function to format column names display
  const formatColumns = (cols) => {
    if (!cols || cols.length === 0) return "";
    return ` (${cols.join(", ")})`;
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      {/* PDF Generation Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 z-50 flex items-center justify-center">
          <div className="relative">
            {/* Animated background circles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-32 h-32 bg-blue-400/20 rounded-full animate-ping"></div>
              <div className="absolute w-24 h-24 bg-purple-400/20 rounded-full animate-pulse"></div>
            </div>

            {/* Main content card */}
            <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6 min-w-[320px]">
              {/* Spinner with gradient */}
              <div className="relative">
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200"></div>
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-transparent border-t-blue-600 border-r-purple-600 absolute top-0 left-0"></div>
              </div>

              {/* Text content */}
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Loading report...
                </p>
                <p className="text-sm text-slate-600">
                  Please wait while we generate your PDF
                </p>
              </div>

              {/* Progress dots */}
              <div className="flex gap-2">
                <div
                  className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-pink-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">
              Report
            </h1>
            <nav className="flex items-center gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200"
              >
                <span className="text-base">🏠</span>
                Home
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-pink-600 to-pink-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-pink-700 hover:to-pink-800 transition-all duration-200"
              >
                <span className="text-base">🎛️</span>
                Dashboard
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main ref={mainRef} className="max-w-6xl mx-auto px-4 py-8">
        {/* Official PDF Header - Visible only in PDF export */}
        <div className="hide-in-screen official-report-header">
          <div className="border-b-4 border-blue-600 pb-6 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  BiasXplorer
                </h1>
                <p className="text-lg text-slate-600">
                  Dataset Bias Analysis Report
                </p>
              </div>
              <div className="text-right text-sm text-slate-600">
                <div className="font-semibold text-blue-600">
                  OFFICIAL REPORT
                </div>
                <div>Report ID: {`BXR-${Date.now().toString().slice(-8)}`}</div>
                <div>
                  Generated:{" "}
                  {new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <div>
                  Time:{" "}
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mt-4">
              <p className="text-sm text-slate-700">
                <strong>Confidential:</strong> This report contains analysis
                results for dataset bias detection and correction. The
                information herein is intended for authorized personnel only.
              </p>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="mb-8 bg-slate-50 border border-slate-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 border-b-2 border-slate-300 pb-2">
              Executive Summary
            </h2>
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <strong>Total Columns Analyzed:</strong>{" "}
                {biasSeverityCounts.totalSelectedAll}
              </p>
              <p>
                <strong>Columns Corrected:</strong> {totalFixedCount}
              </p>
              <p>
                <strong>Categorical Issues Identified:</strong>{" "}
                {biasSeverityCounts.Severe} Severe,{" "}
                {biasSeverityCounts.Moderate} Moderate, {biasSeverityCounts.Low}{" "}
                Low
              </p>
              <p>
                <strong>Continuous Distribution Issues:</strong>{" "}
                {biasSeverityCounts.continuous?.right ?? 0} Right-skewed,{" "}
                {biasSeverityCounts.continuous?.left ?? 0} Left-skewed
              </p>
              <p className="pt-2 border-t border-slate-300 mt-3">
                <strong>Analysis Status:</strong>{" "}
                <span className="text-green-700 font-semibold">Complete</span>
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* Summary grid: Bias + Correction only */}
        <div className="report-section page-break-before-analysis">
          {/* Section number for PDF */}
          <div className="hide-in-screen">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-slate-300 pb-2">
              1. ANALYSIS OVERVIEW
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm official-card">
              <h3 className="font-semibold text-slate-800 mb-3 text-base hide-in-pdf">
                1.1 Bias Detection Summary
              </h3>
              <h3
                className="font-semibold text-slate-800 mb-4 text-base hide-in-screen"
                style={{
                  borderBottom: "1px solid #cbd5e1",
                  paddingBottom: "8px",
                }}
              >
                1.1 Bias Detection Summary
              </h3>

              {/* Overview Section - Web */}
              <div className="bg-slate-50 rounded-lg p-3 mb-3 border border-slate-100 hide-in-pdf">
                <div className="text-base text-slate-700 mb-1">
                  Columns fixed: {totalFixedCount}
                  {formatColumns(
                    Object.keys(latestCategorical).concat(
                      Object.keys(latestContinuous)
                    )
                  )}
                </div>
                <div className="text-base text-slate-700">
                  Total columns selected: {biasSeverityCounts.totalSelectedAll}
                </div>
              </div>

              {/* Overview Section - PDF only */}
              <div className="hide-in-screen">
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "12px",
                    fontSize: "12px",
                  }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          padding: "8px",
                          fontWeight: 600,
                          width: "60%",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Columns Fixed:
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {totalFixedCount}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "8px",
                          fontWeight: 600,
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        Total Columns Selected:
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {biasSeverityCounts.totalSelectedAll}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Categorical Section - Web only */}
              <div className="bg-amber-50 rounded-lg p-3 mb-3 border border-amber-100 hide-in-pdf">
                <div className="text-sm font-semibold text-amber-900 mb-2">
                  Categorical
                </div>
                <div className="text-sm text-green-700">
                  Low: {biasSeverityCounts.Low}
                  {formatColumns(biasSeverityCounts.LowCols)}
                </div>
                <div className="text-sm text-amber-900">
                  Moderate: {biasSeverityCounts.Moderate}
                  {formatColumns(biasSeverityCounts.ModerateCols)}
                </div>
                <div className="text-sm text-red-900">
                  Severe: {biasSeverityCounts.Severe}
                  {formatColumns(biasSeverityCounts.SevereCols)}
                </div>
                <div className="text-sm text-slate-500">
                  Not tested: {biasSeverityCounts.NotTested}
                  {formatColumns(biasSeverityCounts.NotTestedCols)}
                </div>
              </div>

              {/* Categorical Section - PDF only */}
              <div className="hide-in-screen">
                <p
                  style={{
                    fontWeight: 600,
                    marginBottom: "6px",
                    fontSize: "13px",
                  }}
                >
                  Categorical Bias Results:
                </p>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginBottom: "10px",
                    fontSize: "11px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "left",
                          fontWeight: 600,
                          borderBottom: "2px solid #cbd5e1",
                        }}
                      >
                        Severity Level
                      </th>
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 600,
                          borderBottom: "2px solid #cbd5e1",
                        }}
                      >
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px" }}>Low</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {biasSeverityCounts.Low}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px" }}>Moderate</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {biasSeverityCounts.Moderate}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px" }}>Severe</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {biasSeverityCounts.Severe}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 8px", color: "#64748b" }}>
                        Not Tested
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: "#64748b",
                        }}
                      >
                        {biasSeverityCounts.NotTested}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Continuous Section - Web only */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 hide-in-pdf">
                <div className="text-sm font-semibold text-blue-900 mb-2">
                  Continuous
                </div>
                <div className="text-sm text-blue-900">
                  Right skew: {biasSeverityCounts.continuous?.right ?? 0}
                  {formatColumns(biasSeverityCounts.continuous?.rightCols)}
                </div>
                <div className="text-sm text-indigo-900">
                  Left skew: {biasSeverityCounts.continuous?.left ?? 0}
                  {formatColumns(biasSeverityCounts.continuous?.leftCols)}
                </div>
                <div className="text-sm text-emerald-800">
                  Approximately normal:{" "}
                  {biasSeverityCounts.continuous?.normal ?? 0}
                  {formatColumns(biasSeverityCounts.continuous?.normalCols)}
                </div>
                <div className="text-sm text-slate-500">
                  Not tested: {biasSeverityCounts.continuous?.notTested ?? 0}
                  {formatColumns(biasSeverityCounts.continuous?.notTestedCols)}
                </div>
              </div>

              {/* Continuous Section - PDF only */}
              <div className="hide-in-screen">
                <p
                  style={{
                    fontWeight: 600,
                    marginBottom: "6px",
                    fontSize: "13px",
                  }}
                >
                  Continuous Distribution Results:
                </p>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "11px",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "left",
                          fontWeight: 600,
                          borderBottom: "2px solid #cbd5e1",
                        }}
                      >
                        Distribution Type
                      </th>
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 600,
                          borderBottom: "2px solid #cbd5e1",
                        }}
                      >
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px" }}>Right Skewed</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {biasSeverityCounts.continuous?.right ?? 0}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px" }}>Left Skewed</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {biasSeverityCounts.continuous?.left ?? 0}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "6px 8px" }}>
                        Approximately Normal
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {biasSeverityCounts.continuous?.normal ?? 0}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 8px", color: "#64748b" }}>
                        Not Tested
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          color: "#64748b",
                        }}
                      >
                        {biasSeverityCounts.continuous?.notTested ?? 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm official-card">
              <h3 className="font-semibold text-slate-800 mb-3 text-base">
                1.2 Correction Implementation Summary
              </h3>
              {/* Corrected file path intentionally hidden as requested */}
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-sm font-semibold text-amber-900 mb-2">
                    Categorical
                  </div>
                  <div className="text-sm text-amber-900">
                    Total selected:{" "}
                    {metaCounts?.categorical?.total_selected ??
                      fallbackCounts.categorical.total_selected ??
                      "-"}
                    {formatColumns(
                      correctionColumnDetails.categorical.selected
                    )}
                  </div>
                  <div className="text-sm text-amber-900">
                    Needing fix:{" "}
                    {metaCounts?.categorical?.needing_fix ??
                      fallbackCounts.categorical.needing_fix ??
                      "-"}
                    {formatColumns(
                      correctionColumnDetails.categorical.needingFix
                    )}
                  </div>
                  <div className="text-sm text-amber-900">
                    Fixed: {Object.keys(latestCategorical).length}
                    {formatColumns(correctionColumnDetails.categorical.fixed)}
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-sm font-semibold text-blue-900 mb-2">
                    Continuous
                  </div>
                  <div className="text-sm text-blue-900">
                    Total selected:{" "}
                    {metaCounts?.continuous?.total_selected ??
                      fallbackCounts.continuous.total_selected ??
                      "-"}
                    {formatColumns(correctionColumnDetails.continuous.selected)}
                  </div>
                  <div className="text-sm text-blue-900">
                    Needing fix:{" "}
                    {metaCounts?.continuous?.needing_fix ??
                      fallbackCounts.continuous.needing_fix ??
                      "-"}
                    {formatColumns(
                      correctionColumnDetails.continuous.needingFix
                    )}
                  </div>
                  <div className="text-sm text-blue-900">
                    Fixed: {Object.keys(latestContinuous).length}
                    {formatColumns(correctionColumnDetails.continuous.fixed)}
                  </div>
                </div>
              </div>
              {(legacyMethod || legacyBeforeTotal || legacyAfterTotal) && (
                <div className="mt-2 text-xs text-slate-500">
                  Legacy summary — Method: {legacyMethod || "-"}; Before:{" "}
                  {legacyBeforeTotal ?? "-"}; After: {legacyAfterTotal ?? "-"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Correction Details */}
        {(() => {
          // Check if we have any fixed columns using same logic as visualizations
          const biasFixResult = getStorageValue(
            "dashboard_biasFixResult",
            null
          );
          const skewnessFixResult = getStorageValue(
            "dashboard_skewnessFixResult",
            null
          );
          const hasCategorical =
            Object.keys(latestCategorical).length > 0 ||
            (biasFixResult?.columns &&
              Object.keys(biasFixResult.columns).length > 0);
          const hasContinuous =
            Object.keys(latestContinuous).length > 0 ||
            (skewnessFixResult?.transformations &&
              Object.keys(skewnessFixResult.transformations).length > 0);
          return hasCategorical || hasContinuous;
        })() && (
          <div className="grid grid-cols-1 gap-6 mb-6 report-section">
            {/* Section header for PDF */}
            <div className="hide-in-screen">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-slate-300 pb-2">
                2. DETAILED CORRECTION RESULTS
              </h2>
            </div>

            {(() => {
              const catCols = Object.keys(latestCategorical);
              const biasFixResult = getStorageValue(
                "dashboard_biasFixResult",
                null
              );
              return (
                catCols.length > 0 ||
                (biasFixResult?.columns &&
                  Object.keys(biasFixResult.columns).length > 0)
              );
            })() && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 avoid-break official-section">
                <h3 className="text-lg font-bold text-amber-900 mb-4">
                  2.1 Categorical Bias Corrections
                </h3>
                <p className="text-sm text-slate-600 mb-4 hide-in-screen-only">
                  The following categorical columns were corrected using
                  specified methods to balance class distributions:
                </p>
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
                      {(() => {
                        // Use latestCategorical if available, otherwise fallback to biasFixResult
                        const entries =
                          Object.keys(latestCategorical).length > 0
                            ? Object.entries(latestCategorical)
                            : Object.entries(
                                getStorageValue("dashboard_biasFixResult", null)
                                  ?.columns || {}
                              ).map(([col, data]) => [
                                col,
                                {
                                  method: data.method,
                                  threshold: data.threshold,
                                  before: data.before,
                                  after: data.after,
                                  ts: Date.now(),
                                },
                              ]);
                        return entries.map(([col, entry]) => {
                          return (
                            <tr
                              key={`${col}-latest`}
                              className="hover:bg-amber-50/60"
                            >
                              <td className="px-4 py-3 font-semibold">{col}</td>
                              <td className="px-4 py-3">
                                {entry?.method || "-"}
                              </td>
                              <td className="px-4 py-3">
                                {entry?.threshold ?? "-"}
                              </td>
                              <td className="px-4 py-3">
                                {entry?.before?.total ?? "-"}
                              </td>
                              <td className="px-4 py-3">
                                {entry?.after?.total ?? "-"}
                              </td>
                              <td className="px-4 py-3">
                                {(() => {
                                  const r = computeRatio(
                                    entry?.before?.distribution || entry?.before
                                  );
                                  return r === null ? "-" : r;
                                })()}
                              </td>
                              <td className="px-4 py-3">
                                {(() => {
                                  const r = computeRatio(
                                    entry?.after?.distribution || entry?.after
                                  );
                                  return r === null ? "-" : r;
                                })()}
                              </td>
                              <td className="px-4 py-3">
                                {entry?.ts
                                  ? new Date(entry.ts).toLocaleString()
                                  : "-"}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(() => {
              const contCols = Object.keys(latestContinuous);
              const skewnessFixResult = getStorageValue(
                "dashboard_skewnessFixResult",
                null
              );
              return (
                contCols.length > 0 ||
                (skewnessFixResult?.transformations &&
                  Object.keys(skewnessFixResult.transformations).length > 0)
              );
            })() && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 avoid-break official-section">
                <h3 className="text-lg font-bold text-blue-900 mb-4">
                  2.2 Continuous Distribution Corrections
                </h3>
                <p className="text-sm text-slate-600 mb-4 hide-in-screen-only">
                  The following continuous columns were transformed to reduce
                  skewness and normalize distributions:
                </p>
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
                      {(() => {
                        // Use latestContinuous if available, otherwise fallback to skewnessFixResult
                        const entries =
                          Object.keys(latestContinuous).length > 0
                            ? Object.entries(latestContinuous)
                            : Object.entries(
                                getStorageValue(
                                  "dashboard_skewnessFixResult",
                                  null
                                )?.transformations || {}
                              ).map(([col, info]) => [
                                col,
                                {
                                  original_skewness: info.original_skewness,
                                  new_skewness: info.new_skewness,
                                  method: info.method,
                                  ts: Date.now(),
                                },
                              ]);
                        return entries.map(([col, entry]) => {
                          return (
                            <tr
                              key={`${col}-latest`}
                              className="hover:bg-blue-50/60"
                            >
                              <td className="px-4 py-3 font-semibold">{col}</td>
                              <td className="px-4 py-3">
                                {entry?.original_skewness ?? "-"}
                              </td>
                              <td className="px-4 py-3">
                                {entry?.new_skewness ?? "-"}
                              </td>
                              <td className="px-4 py-3">
                                {entry?.method || "-"}
                              </td>
                              <td className="px-4 py-3">
                                {entry?.ts
                                  ? new Date(entry.ts).toLocaleString()
                                  : "-"}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visualizations Section - full width, placed below summaries */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6 report-section page-break-before">
          {/* Section header for PDF */}
          <div className="hide-in-screen" style={{ marginBottom: "8px" }}>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 border-b-2 border-slate-300 pb-2">
              3. VISUAL ANALYSIS
            </h2>
          </div>

          <h3 className="text-lg font-semibold text-slate-800 mb-4 hide-in-pdf">
            Visualizations
          </h3>
          {vizError && (
            <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {vizError}
            </div>
          )}
          {vizLoading && (
            <div className="my-2">
              <Spinner text="Loading visualizations..." />
            </div>
          )}
          {!vizLoading && !vizError && (
            <>
              {Object.keys(vizCategorical).length === 0 &&
              Object.keys(vizContinuous).length === 0 ? (
                <div className="text-sm text-slate-700">
                  No visualizations available. Generate corrections first.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Class Weights Summary - For reweight method */}
                  {(() => {
                    const biasFixResult = getStorageValue(
                      "dashboard_biasFixResult",
                      null
                    );
                    if (!biasFixResult?.columns) return null;

                    // Filter columns with reweight method and class_weights
                    const reweightColumns = Object.entries(
                      biasFixResult.columns
                    )
                      .filter(
                        ([, colData]) =>
                          colData?.method === "reweight" &&
                          colData?.class_weights
                      )
                      .map(([col]) => col);

                    if (reweightColumns.length === 0) return null;

                    return (
                      <div className="avoid-break">
                        <h4 className="font-bold text-slate-800 mb-3 text-base">
                          3.1 Class Weights Summary (Reweight Method)
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          {reweightColumns.map((col) => {
                            const colData = biasFixResult.columns[col];
                            const weights = colData.class_weights;

                            return (
                              <div
                                key={`reweight-${col}`}
                                className="rounded-md border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-4 avoid-break"
                              >
                                <div className="mb-2">
                                  <span className="text-sm font-semibold text-purple-900">
                                    {col}
                                  </span>
                                  <span className="ml-2 text-xs text-purple-700">
                                    Method: Reweight
                                  </span>
                                </div>
                                <div className="text-sm text-purple-800 mb-3">
                                  The <strong>reweight</strong> method computes
                                  class weights without modifying the dataset.
                                  Use these weights in your model's{" "}
                                  <code className="bg-purple-200 px-1 rounded">
                                    class_weight
                                  </code>{" "}
                                  parameter or{" "}
                                  <code className="bg-purple-200 px-1 rounded">
                                    sample_weight
                                  </code>{" "}
                                  during training.
                                </div>
                                <div className="bg-white rounded border border-purple-200 p-3">
                                  <div className="text-xs font-semibold text-purple-700 mb-2">
                                    Computed Class Weights:
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {Object.entries(weights).map(
                                      ([cls, weight]) => (
                                        <div
                                          key={cls}
                                          className="bg-purple-50 rounded px-2 py-1 text-xs"
                                        >
                                          <span className="font-medium text-purple-900">
                                            {cls}:
                                          </span>{" "}
                                          <span className="text-purple-700">
                                            {typeof weight === "number"
                                              ? weight.toFixed(4)
                                              : weight}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Categorical */}
                  {Object.keys(vizCategorical).length > 0 && (
                    <div className="avoid-break">
                      <h4 className="font-bold text-slate-800 mb-3 text-base">
                        {(() => {
                          const biasFixResult = getStorageValue(
                            "dashboard_biasFixResult",
                            null
                          );
                          const hasReweight = biasFixResult?.columns
                            ? Object.values(biasFixResult.columns).some(
                                (colData) => colData?.method === "reweight"
                              )
                            : false;
                          return hasReweight
                            ? "3.2 Categorical Distribution Comparisons"
                            : "3.1 Categorical Distribution Comparisons";
                        })()}
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(vizCategorical).map(([col, data]) => (
                          <div
                            key={`cat-${col}`}
                            className="rounded-md border border-slate-200 bg-white p-3 avoid-break"
                          >
                            <div className="mb-2 text-sm font-semibold text-slate-700">
                              {col}
                            </div>
                            {data.error ? (
                              <div className="text-sm text-red-700">
                                {data.error}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 avoid-break">
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">
                                    Before
                                  </div>
                                  {data.before_chart ? (
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
                                      config={{
                                        responsive: true,
                                        displayModeBar: false,
                                      }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  ) : data.beforeData ? (
                                    <Plot
                                      className="w-full overflow-hidden"
                                      data={[
                                        {
                                          x: data.beforeData.categories,
                                          y: data.beforeData.values.map(
                                            (v) => v / 100
                                          ),
                                          type: "bar",
                                          text: data.beforeData.values.map(
                                            (v) => `${v.toFixed(2)}%`
                                          ),
                                          textposition: "outside",
                                          marker: {
                                            color: "#4C78A8",
                                            line: {
                                              color: "#2C5282",
                                              width: 1,
                                            },
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
                                          pad: { l: 2 },
                                        },
                                        xaxis_title: "Class",
                                        yaxis_title: "Proportion",
                                        yaxis: {
                                          range: [0, 1],
                                          tickformat: ".0%",
                                        },
                                        plot_bgcolor: "white",
                                        autosize: true,
                                        height: 400,
                                        width: undefined,
                                        margin: { l: 50, r: 30, t: 60, b: 50 },
                                        hovermode: "closest",
                                        xaxis: {
                                          showgrid: true,
                                          gridwidth: 1,
                                          gridcolor: "#E2E8F0",
                                        },
                                      }}
                                      config={{
                                        responsive: true,
                                        displayModeBar: false,
                                      }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">
                                    After
                                  </div>
                                  {data.after_chart ? (
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
                                      config={{
                                        responsive: true,
                                        displayModeBar: false,
                                      }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  ) : data.afterData ? (
                                    <Plot
                                      className="w-full overflow-hidden"
                                      data={[
                                        {
                                          x: data.afterData.categories,
                                          y: data.afterData.values.map(
                                            (v) => v / 100
                                          ),
                                          type: "bar",
                                          text: data.afterData.values.map(
                                            (v) => `${v.toFixed(2)}%`
                                          ),
                                          textposition: "outside",
                                          marker: {
                                            color: "#4C78A8",
                                            line: {
                                              color: "#2C5282",
                                              width: 1,
                                            },
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
                                          pad: { l: 2 },
                                        },
                                        xaxis_title: "Class",
                                        yaxis_title: "Proportion",
                                        yaxis: {
                                          range: [0, 1],
                                          tickformat: ".0%",
                                        },
                                        plot_bgcolor: "white",
                                        autosize: true,
                                        height: 400,
                                        width: undefined,
                                        margin: { l: 50, r: 30, t: 60, b: 50 },
                                        hovermode: "closest",
                                        xaxis: {
                                          showgrid: true,
                                          gridwidth: 1,
                                          gridcolor: "#E2E8F0",
                                        },
                                      }}
                                      config={{
                                        responsive: true,
                                        displayModeBar: false,
                                      }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  ) : null}
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
                      <h4 className="font-bold text-slate-800 mb-3 text-base">
                        {(() => {
                          const biasFixResult = getStorageValue(
                            "dashboard_biasFixResult",
                            null
                          );
                          const hasReweight = biasFixResult?.columns
                            ? Object.values(biasFixResult.columns).some(
                                (colData) => colData?.method === "reweight"
                              )
                            : false;
                          const hasCategoricalViz =
                            Object.keys(vizCategorical).length > 0;

                          // Numbering: if reweight exists (3.1), categorical is 3.2, continuous is 3.3
                          // if no reweight but categorical exists, categorical is 3.1, continuous is 3.2
                          // if only continuous, it's 3.1
                          if (hasReweight && hasCategoricalViz) {
                            return "3.3 Continuous Distribution Comparisons";
                          } else if (hasCategoricalViz) {
                            return "3.2 Continuous Distribution Comparisons";
                          } else {
                            return "3.1 Continuous Distribution Comparisons";
                          }
                        })()}
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        {Object.entries(vizContinuous).map(([col, data]) => (
                          <div
                            key={`cont-${col}`}
                            className="rounded-md border border-slate-200 bg-white p-3 avoid-break"
                          >
                            <div className="mb-2 text-sm font-semibold text-slate-700">
                              {col}
                            </div>
                            {data.error ? (
                              <div className="text-sm text-red-700">
                                {data.error}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 avoid-break">
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">
                                    Before
                                  </div>
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
                                      config={{
                                        responsive: true,
                                        displayModeBar: false,
                                      }}
                                      style={{ width: "100%", height: 400 }}
                                      useResizeHandler
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 overflow-hidden avoid-break">
                                  <div className="text-xs text-slate-600 mb-1">
                                    After
                                  </div>
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
                                      config={{
                                        responsive: true,
                                        displayModeBar: false,
                                      }}
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
              <p className="text-sm text-slate-600">
                Keep this for your records.
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

        {/* Download Class Weights - Hidden in PDF export */}
        {(() => {
          const biasFixResult = getStorageValue(
            "dashboard_biasFixResult",
            null
          );
          const hasReweight = biasFixResult?.columns
            ? Object.values(biasFixResult.columns).some(
                (colData) =>
                  colData?.method === "reweight" && colData?.class_weights
              )
            : false;

          if (!hasReweight) return null;

          return (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm hide-in-pdf">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    Download Class Weights
                  </h2>
                  <p className="text-sm text-slate-600">
                    JSON file containing computed class weights for all reweight
                    columns.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={downloadWeights}
                  >
                    Download Weights
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Navigation - Previous Button */}
        <div className="mt-6 flex items-center justify-start hide-in-pdf">
          <Link
            to="/dashboard"
            className="group px-6 py-3 text-sm font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift flex items-center gap-2"
          >
            <span className="group-hover:-translate-x-1 transition-transform">
              ←
            </span>
            <span>Previous</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
