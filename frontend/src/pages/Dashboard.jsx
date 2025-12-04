import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { usePersistedState } from "../hooks/usePersistedState";
import DatasetPreview from "../components/DatasetPreview";
import Preprocess from "../components/Preprocess";
import ColumnSelector from "../components/ColumnSelector";
import FeatureSelector from "../components/FeatureSelector";
import BiasDetection from "../components/BiasDetection";
import UnifiedBiasFix from "../components/UnifiedBiasFix";
import Visualization from "../components/Visualization";

const STEPS = [
  "Dataset Preview",
  "Data Preprocessing",
  "Target Column Selection",
  "Column Type Classification",
  "Bias Detection",
  "Bias Fix",
  "Visualization",
];

export default function Dashboard() {
  const location = useLocation();
  const initialFilePath = location.state?.filePath || "";

  // Initialize all state variables first - order matters!
  const [currentStep, setCurrentStep] = usePersistedState(
    "dashboard_currentStep",
    1
  );
  const [filePath] = usePersistedState(
    "dashboard_filePath",
    initialFilePath
  );
  const [columns, setColumns] = usePersistedState("dashboard_columns", []);
  const [selectedColumns, setSelectedColumns] = usePersistedState(
    "dashboard_selectedColumns",
    []
  );
  const [categorical, setCategorical] = usePersistedState(
    "dashboard_categorical",
    []
  );
  const [continuous, setContinuous] = usePersistedState(
    "dashboard_continuous",
    []
  );
  const [biasResults, setBiasResults] = usePersistedState(
    "dashboard_biasResults",
    {}
  );
  const [skewnessResults, setSkewnessResults] = usePersistedState(
    "dashboard_skewnessResults",
    {}
  );
  const [selectedFilePath, setSelectedFilePath] = usePersistedState(
    "dashboard_selectedFilePath",
    ""
  );
  const [biasSummary, setBiasSummary] = usePersistedState(
    "dashboard_biasSummary",
    null
  );
  const [targetColumn, setTargetColumn] = usePersistedState(
    "dashboard_targetColumn",
    ""
  );
  const [correctedFilePath, setCorrectedFilePath] = usePersistedState(
    "dashboard_correctedFilePath",
    ""
  );
  const [visualizationKey, setVisualizationKey] = usePersistedState(
    "dashboard_visualizationKey",
    0
  );
  const [cleanedFilePath, setCleanedFilePath] = usePersistedState(
    "dashboard_cleanedFilePath",
    ""
  );
  const [selectedSkewnessColumns, setSelectedSkewnessColumns] = useState([]);
  const [selectedBiasColumns, setSelectedBiasColumns] = useState([]);
  const [fixedCategoricalColumns, setFixedCategoricalColumns] =
    usePersistedState("dashboard_fixedCategoricalColumns", []);
  const [fixedContinuousColumns, setFixedContinuousColumns] = usePersistedState(
    "dashboard_fixedContinuousColumns",
    []
  );
  const [isApplyingFixes, setIsApplyingFixes] = useState(false); // Track if fixes are being applied

  // Persisted state for fix results (to show when navigating back)
  const [biasFixResult, setBiasFixResult] = usePersistedState(
    "dashboard_biasFixResult",
    null
  );
  const [skewnessFixResult, setSkewnessFixResult] = usePersistedState(
    "dashboard_skewnessFixResult",
    null
  );

  // Persisted report summaries for the Report page
  const [reportBiasSummary, setReportBiasSummary] = usePersistedState(
    "dashboard_reportBiasSummary",
    null
  );
  const [reportCorrectionSummary, setReportCorrectionSummary] = usePersistedState(
    "dashboard_reportCorrectionSummary",
    null
  );

  

  // Store the file path that was used as input to bias fixing (for visualization "before" state)
  const [beforeFixFilePath, setBeforeFixFilePath] = usePersistedState(
    "dashboard_beforeFixFilePath",
    ""
  );

  // Persisted state for selected columns (to restore checkboxes when navigating back)
  const [persistedBiasSelectedColumns, setPersistedBiasSelectedColumns] =
    usePersistedState("dashboard_biasSelectedColumns", []);
  const [
    persistedSkewnessSelectedColumns,
    setPersistedSkewnessSelectedColumns,
  ] = usePersistedState("dashboard_skewnessSelectedColumns", []);

  // State declarations removed as they were duplicated

  // Clear cleanedFilePath when on Step 1 (fresh start)
  useEffect(() => {
    if (currentStep === 1 && cleanedFilePath) {
      setCleanedFilePath("");
    }
  }, [currentStep, cleanedFilePath, setCleanedFilePath]);

  // Prefer cleaned > selected > original dataset for downstream steps
  const workingFilePath = useMemo(
    () => cleanedFilePath || selectedFilePath || filePath,
    [cleanedFilePath, selectedFilePath, filePath]
  );

  // Target column will be selected manually by the user

  const pct = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleSelectedColumnsChange = useCallback(
    ({ biasSelectedColumns, skewnessSelectedColumns }) => {
      console.log("[Dashboard] handleSelectedColumnsChange called:", {
        biasSelectedColumns,
        skewnessSelectedColumns,
        currentPersistedBias: persistedBiasSelectedColumns,
        currentPersistedSkewness: persistedSkewnessSelectedColumns,
      });
      if (biasSelectedColumns !== undefined) {
        setPersistedBiasSelectedColumns(biasSelectedColumns);
      }
      if (skewnessSelectedColumns !== undefined) {
        setPersistedSkewnessSelectedColumns(skewnessSelectedColumns);
      }
    },
    [
      setPersistedBiasSelectedColumns,
      setPersistedSkewnessSelectedColumns,
      persistedBiasSelectedColumns,
      persistedSkewnessSelectedColumns,
    ]
  );

  const handleResultsChange = useCallback(
    async ({ biasFixResult: newBiasResult, skewnessFixResult: newSkewResult }) => {
      console.log("[Dashboard] onResultsChange called:", {
        newBiasResult,
        newSkewResult,
        currentBiasFixResult: biasFixResult,
        currentSkewnessFixResult: skewnessFixResult,
      });
      if (newBiasResult !== undefined) {
        console.log("[Dashboard] Setting biasFixResult to:", newBiasResult);
        setBiasFixResult(newBiasResult);
      }
      if (newSkewResult !== undefined) {
        console.log("[Dashboard] Setting skewnessFixResult to:", newSkewResult);
        setSkewnessFixResult(newSkewResult);
      }

      // Call backend to compute report summaries instead of calculating locally
      try {
        const response = await fetch("http://localhost:5000/api/bias/compute-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bias_results: biasResults,
            skewness_results: skewnessResults,
            bias_fix_result: newBiasResult,
            skewness_fix_result: newSkewResult,
            selected_columns: selectedColumns,
            categorical: categorical,
            continuous: continuous
          }),
        });

        if (!response.ok) {
          throw new Error(`Backend summary computation failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("[Dashboard] Backend computed summaries:", data);

        // Update state with backend-computed summaries
        if (data.bias_summary !== undefined) {
          setReportBiasSummary(data.bias_summary);
        }
        
        if (data.correction_summary !== undefined) {
          setReportCorrectionSummary(data.correction_summary);
        }

      } catch (e) {
        console.warn("[Dashboard] Failed to compute report summaries via backend:", e);
        // Fall back to not updating summaries if backend fails
      }
    },
    [
      biasResults,
      skewnessResults,
      categorical,
      continuous,
      selectedColumns,
      biasFixResult,
      skewnessFixResult,
      setBiasFixResult,
      setSkewnessFixResult,
      setReportBiasSummary,
      setReportCorrectionSummary,
    ]
  );

  if (!workingFilePath && currentStep > 1) {
    // Guide users back to upload if they landed here without a file
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4">
          <div className="rounded-3xl border-2 border-white/50 glass-effect p-12 shadow-2xl text-center animate-scaleIn">
            <div className="text-8xl mb-6">⚠️</div>
            <h2 className="text-3xl font-bold text-slate-800 mb-4">
              No Dataset Found
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              It looks like you haven't uploaded a dataset yet. Please go back
              to the Home page and upload your data to begin exploring!
            </p>
            <Link
              className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-white font-bold text-lg hover:from-blue-700 hover:to-indigo-700 shadow-xl hover:shadow-2xl transition-all duration-300 card-hover-lift"
              to="/"
            >
              <span>🏠</span>
              <span>Go to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const StepHeader = () => (
    <header className="border-b border-white/30 glass-effect sticky top-0 z-50 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 animate-fadeInLeft">
            <div className="text-3xl animate-pulse">📊</div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gradient-blue tracking-tight">
                Dashboard
              </h1>
              <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                <span className="font-semibold">Active File:</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-mono text-[10px]">
                  {workingFilePath?.split("/").pop() ||
                    workingFilePath ||
                    "(none)"}
                </span>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2 animate-fadeInRight">
            <Link
              to="/"
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift"
            >
              🏠 Home
            </Link>
            <Link
              to="/report"
              state={{
                biasSummary: reportBiasSummary || biasSummary || {},
                correctionSummary: reportCorrectionSummary || null,
                correctedPath: correctedFilePath || "",
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift"
            >
              📊 Reports
            </Link>
          </nav>
        </div>

        {/* Progress bar */}
        <div className="animate-fadeInUp">
          <div className="relative h-3 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-700 ease-out shadow-lg"
              style={{ width: `${pct}%` }}
            >
            </div>
                
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-[10px]">
            {STEPS.map((label, i) => {
              const stepNum = i + 1;
              const active = stepNum === currentStep;
              const done = stepNum < currentStep;
              const stepIcons = ["📂", "🧹", "🎯", "🔤", "🔍", "🛠️", "📈"];

              return (
                <div
                  key={label}
                  className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                    active ? "scale-110" : done ? "opacity-80" : "opacity-50"
                  }`}
                >
                  <div
                    className={`relative inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                      done
                        ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg scale-95"
                        : active
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl animate-pulseGlow"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {done ? "✓" : stepIcons[i]}
                  </div>
                  <span
                    className={`text-center leading-tight font-medium ${
                      active
                        ? "text-blue-700"
                        : done
                        ? "text-slate-700"
                        : "text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );

  const NavButtons = ({ onPrev, onNext, nextDisabled }) => (
    <div className="mt-6 flex items-center justify-between">
      <button
        type="button"
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        onClick={onPrev}
        disabled={currentStep === 1}
      >
        Back
      </button>
      <button
        type="button"
        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        onClick={onNext}
        disabled={nextDisabled}
      >
        Next
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-gradient">
      <StepHeader />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Step 1: Preview */}
        {currentStep === 1 && (
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp">
            <DatasetPreview
              filePath={filePath}
              onNext={({ columns: cols }) => {
                // Reset all column-related states when loading new data
                setColumns(cols || []);
                setSelectedColumns([]);
                setCategorical([]);
                setContinuous([]);
                setBiasSummary(null);
                setBiasResults({});
                setSkewnessResults(null);
                setCleanedFilePath(""); // Clear cleaned file path
                setCorrectedFilePath(""); // Clear corrected file path
                setBeforeFixFilePath(""); // Clear before fix file path
                // Clear report summaries
                setReportBiasSummary(null);
                setReportCorrectionSummary(null);
                // Clear persisted fix selections and results
                setPersistedBiasSelectedColumns([]);
                setPersistedSkewnessSelectedColumns([]);
                setBiasFixResult(null);
                setSkewnessFixResult(null);
                setCurrentStep(2);
              }}
            />
          </section>
        )}

        {/* Step 2: Data Preprocessing */}
        {currentStep === 2 && (
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp">
            <Preprocess
              filePath={selectedFilePath || filePath}
              onComplete={({ cleanedFilePath: cleaned }) => {
                if (cleaned) {
                  setCleanedFilePath(cleaned);
                }
              }}
            />

            <div className="flex justify-between items-center mt-8 pt-6 border-t-2 border-slate-200">
              <button
                onClick={() => setCurrentStep(1)}
                className="group px-6 py-3 text-sm font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift flex items-center gap-2"
              >
                <span className="group-hover:-translate-x-1 transition-transform">
                  ←
                </span>
                <span>Previous</span>
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="group px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 card-hover-lift flex items-center gap-2"
              >
                <span>Next</span>
                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Target Column Selection */}
        {currentStep === 3 && (
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp">
            <FeatureSelector
              filePath={workingFilePath}
              columns={columns}
              initialSelected={selectedColumns}
              onSelect={({ features }) => {
                const newSelected = new Set(features);

                // Keep existing results for all currently selected columns
                if (biasSummary) {
                  const newBiasSummary = {};
                  Object.entries(biasSummary).forEach(([col, result]) => {
                    if (newSelected.has(col)) {
                      newBiasSummary[col] = result;
                    }
                  });
                  setBiasSummary(
                    Object.keys(newBiasSummary).length > 0
                      ? newBiasSummary
                      : null
                  );
                  setBiasResults(
                    Object.keys(newBiasSummary).length > 0 ? newBiasSummary : {}
                  );
                }

                if (skewnessResults) {
                  const newSkewResults = {};
                  Object.entries(skewnessResults).forEach(([col, result]) => {
                    if (newSelected.has(col)) {
                      newSkewResults[col] = result;
                    }
                  });
                  setSkewnessResults(
                    Object.keys(newSkewResults).length > 0
                      ? newSkewResults
                      : null
                  );
                }

                setSelectedColumns(features);
                // Clear corrected file path and before fix path when changing columns
                setCorrectedFilePath("");
                setBeforeFixFilePath("");
                // Clear persisted fix selections and results
                setPersistedBiasSelectedColumns([]);
                setPersistedSkewnessSelectedColumns([]);
                setBiasFixResult(null);
                setSkewnessFixResult(null);

                // Clear target column if it's no longer in selected columns
                if (targetColumn && !newSelected.has(targetColumn)) {
                  setTargetColumn("");
                }

                setCurrentStep(4);
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(2)}
              onNext={() => setCurrentStep(4)}
              nextDisabled={!selectedColumns.length}
            />
          </section>
        )}

        {/* Step 4: Column Type Classification */}
        {currentStep === 4 && (
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp">
            <ColumnSelector
              filePath={workingFilePath}
              columns={selectedColumns}
              initialSelections={Object.fromEntries([
                ...categorical.map((col) => [col, "categorical"]),
                ...continuous.map((col) => [col, "continuous"]),
              ])}
              onSubmit={({ categorical: cat, continuous: cont, response }) => {
                // Get current column types
                const oldCatSet = new Set(categorical || []);
                const oldContSet = new Set(continuous || []);
                const newCatSet = new Set(cat || []);
                const newContSet = new Set(cont || []);

                // Check which columns changed type
                const changedColumns = [];
                [...oldCatSet].forEach((col) => {
                  if (newContSet.has(col)) changedColumns.push(col);
                });
                [...oldContSet].forEach((col) => {
                  if (newCatSet.has(col)) changedColumns.push(col);
                });

                // Only reset results for columns that changed type
                if (biasSummary) {
                  const newBiasSummary = { ...biasSummary };
                  changedColumns.forEach((col) => delete newBiasSummary[col]);
                  setBiasSummary(
                    Object.keys(newBiasSummary).length > 0
                      ? newBiasSummary
                      : null
                  );
                  setBiasResults(
                    Object.keys(newBiasSummary).length > 0 ? newBiasSummary : {}
                  );
                }

                if (skewnessResults) {
                  const newSkewResults = { ...skewnessResults };
                  changedColumns.forEach((col) => delete newSkewResults[col]);
                  setSkewnessResults(
                    Object.keys(newSkewResults).length > 0
                      ? newSkewResults
                      : null
                  );
                }

                setCategorical(cat || []);
                setContinuous(cont || []);
                if (response?.selected_file_path) {
                  setSelectedFilePath(response.selected_file_path);
                }

                // Clear corrected file path and before fix path when column types change
                setCorrectedFilePath("");
                setBeforeFixFilePath("");

                // Clear target column if it's no longer categorical or if it changed type
                if (targetColumn && !newCatSet.has(targetColumn)) {
                  setTargetColumn("");
                }

                setCurrentStep(5);
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(3)}
              onNext={() => setCurrentStep(5)}
              nextDisabled={!categorical.length && !continuous.length}
            />
          </section>
        )}

        {/* Step 5: Bias Detection */}
        {currentStep === 5 && (
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp">
            <BiasDetection
              filePath={workingFilePath}
              categorical={categorical}
              continuous={continuous}
              initialResults={biasSummary}
              initialSkewnessResults={skewnessResults}
              removedColumns={[]}
              onFix={({ results, fromButton, targetColumn, targetColumns }) => {
                if (!results) return;
                // Merge new results with existing ones
                setBiasSummary((prevResults) => ({
                  ...prevResults,
                  ...results,
                }));
                setBiasResults((prevResults) => ({
                  ...prevResults,
                  ...results,
                }));

                // Store selected columns for auto-selection in BiasFixSandbox
                if (targetColumns && targetColumns.length > 0) {
                  setSelectedBiasColumns(targetColumns);
                } else if (targetColumn) {
                  setSelectedBiasColumns([targetColumn]);
                  setTargetColumn(targetColumn);
                } else {
                  setSelectedBiasColumns([]);
                  setTargetColumn(""); // Clear for "Fix All"
                }

                // Only navigate when explicitly clicking the Fix button
                if (fromButton) {
                  setCurrentStep(6);
                }
              }}
              onSkewFix={({
                skewnessResults: skewResults,
                fromButton,
                targetColumns,
              }) => {
                if (!skewResults) return;
                // Merge new skewness results with existing ones
                setSkewnessResults((prevResults) => ({
                  ...prevResults,
                  ...skewResults,
                }));

                // Store selected columns for auto-selection in SkewnessFixSandbox
                if (targetColumns && targetColumns.length > 0) {
                  setSelectedSkewnessColumns(targetColumns);
                } else {
                  setSelectedSkewnessColumns([]);
                }

                // Only navigate when explicitly clicking the Fix button
                if (fromButton) {
                  setCurrentStep(6);
                }
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(4)}
              onNext={() => setCurrentStep(6)}
              nextDisabled={!categorical.length && !continuous.length}
            />
          </section>
        )}

        {/* Step 6: Bias Fix */}
        {currentStep === 6 && (
          <section className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl animate-fadeInUp">
            {console.log("[Dashboard Step 6] Rendering UnifiedBiasFix with:", {
              initialBiasFixResult: biasFixResult,
              initialSkewnessFixResult: skewnessFixResult,
            })}
            <UnifiedBiasFix
              filePath={workingFilePath}
              categorical={categorical}
              continuous={continuous}
              biasResults={biasResults}
              skewnessResults={skewnessResults}
              columns={columns}
              selectedBiasColumns={selectedBiasColumns}
              selectedSkewnessColumns={selectedSkewnessColumns}
              onApplyingChange={setIsApplyingFixes} // Track applying state
              initialBiasFixResult={biasFixResult} // Pass persisted results
              initialSkewnessFixResult={skewnessFixResult} // Pass persisted results
              initialBiasSelectedColumns={persistedBiasSelectedColumns} // Pass persisted selections
              initialSkewnessSelectedColumns={persistedSkewnessSelectedColumns} // Pass persisted selections
              onSelectedColumnsChange={handleSelectedColumnsChange}
              onResultsChange={handleResultsChange}
              onFixComplete={(
                correctedPath,
                fixedCategorical,
                fixedContinuous
              ) => {
                console.log("[Dashboard] onFixComplete called with:", {
                  correctedPath,
                  fixedCategorical,
                  fixedContinuous,
                  currentWorkingFilePath: workingFilePath,
                });
                // Save the current working file path as the "before fix" state
                setBeforeFixFilePath(workingFilePath);
                setCorrectedFilePath(correctedPath);
                setFixedCategoricalColumns(fixedCategorical || []);
                setFixedContinuousColumns(fixedContinuous || []);
                setVisualizationKey((prev) => prev + 1);

                // Also update persisted correction summary with corrected path if already prepared
                setReportCorrectionSummary((prev) =>
                  prev
                    ? { ...prev, corrected_file_path: correctedPath }
                    : prev
                );
                console.log(
                  "[Dashboard] State updated - correctedFilePath:",
                  correctedPath,
                  "beforeFixFilePath:",
                  workingFilePath
                );
              }}
            />

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentStep(5)}
                disabled={isApplyingFixes}
              >
                Back
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentStep(7)}
                disabled={isApplyingFixes}
              >
                Next
              </button>
            </div>
          </section>
        )}

        {/* Step 7: Visualization */}
        {currentStep === 7 && (
          <section className="space-y-6 animate-fadeInUp">
            {(() => {
              console.log("[Dashboard Step 7] Current state:", {
                correctedFilePath,
                fixedCategoricalColumns,
                fixedContinuousColumns,
                workingFilePath,
                beforeFixFilePath,
                cleanedFilePath,
                selectedFilePath,
                filePath,
                actualBeforePath: beforeFixFilePath || workingFilePath,
              });
              return null;
            })()}

            {!correctedFilePath && (
              <div className="rounded-3xl border-2 border-white/50 glass-effect p-8 shadow-2xl">
                <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-yellow-50 to-amber-50 p-6 text-amber-900 border-2 border-amber-200 shadow-lg">
                  <div className="text-5xl">⚠️</div>
                  <div>
                    <h3 className="text-lg font-bold mb-1">
                      No Visualizations Available
                    </h3>
                    <p className="text-sm">
                      Please apply bias correction in the previous step before
                      viewing visualizations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {correctedFilePath && (
              <>
                {/* Categorical Visualizations */}
                {fixedCategoricalColumns.length > 0 && (
                  <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-8 shadow-2xl card-hover-lift">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="text-4xl">📊</div>
                      <div>
                        <h3 className="text-2xl font-bold text-amber-900">
                          Categorical Bias - Before & After
                        </h3>
                        <p className="text-sm text-amber-700 mt-1 flex items-center gap-2">
                          <span className="px-3 py-1 bg-amber-200 text-amber-900 rounded-full font-semibold">
                            {fixedCategoricalColumns.length} column
                            {fixedCategoricalColumns.length !== 1
                              ? "s"
                              : ""}{" "}
                            fixed
                          </span>
                        </p>
                      </div>
                    </div>
                    <Visualization
                      key={`viz-cat-${visualizationKey}`}
                      mode="categorical-multi"
                      beforePath={beforeFixFilePath || workingFilePath}
                      afterPath={correctedFilePath}
                      targetColumns={fixedCategoricalColumns}
                    />
                    {/* Debug info */}
                    {(() => {
                      console.log("[Visualization Categorical] Paths:", {
                        beforeFixFilePath,
                        workingFilePath,
                        correctedFilePath,
                        actualBeforePath: beforeFixFilePath || workingFilePath,
                      });
                      return null;
                    })()}
                  </div>
                )}

                {/* Continuous Visualizations */}
                {fixedContinuousColumns.length > 0 && (
                  <div className="rounded-3xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 shadow-2xl card-hover-lift">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="text-4xl">📈</div>
                      <div>
                        <h3 className="text-2xl font-bold text-blue-900">
                          Continuous Skewness - Before & After
                        </h3>
                        <p className="text-sm text-blue-700 mt-1 flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-200 text-blue-900 rounded-full font-semibold">
                            {fixedContinuousColumns.length} column
                            {fixedContinuousColumns.length !== 1
                              ? "s"
                              : ""}{" "}
                            fixed
                          </span>
                        </p>
                      </div>
                    </div>
                    <Visualization
                      key={`viz-cont-${visualizationKey}`}
                      mode="continuous"
                      beforePath={beforeFixFilePath || workingFilePath}
                      afterPath={correctedFilePath}
                      continuous={fixedContinuousColumns}
                    />
                  </div>
                )}

                {fixedCategoricalColumns.length === 0 &&
                  fixedContinuousColumns.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 border border-blue-200">
                        No columns were fixed. Please go back to the Bias Fix
                        step and apply corrections.
                      </div>
                    </div>
                  )}
              </>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-md hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                >
                  <span>←</span>
                  Previous
                </button>
                <Link
                  to="/report"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
                >
                  <span>📊</span>
                  View Report
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
