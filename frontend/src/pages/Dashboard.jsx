import { useEffect, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";
import { usePersistedState } from "../hooks/usePersistedState";
import DatasetPreview from "../components/DatasetPreview";
import ColumnSelector from "../components/ColumnSelector";
import FeatureSelector from "../components/FeatureSelector";
import BiasDetection from "../components/BiasDetection";
import BiasFixSandbox from "../components/BiasFixSandbox";
import SkewnessFixSandbox from "../components/SkewnessFixSandbox";
import Visualization from "../components/Visualization";

const STEPS = [
  "Dataset Preview",
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
  const [previousColumns, setPreviousColumns] = usePersistedState(
    "dashboard_previousColumns",
    []
  );
  const [analyzedColumns, setAnalyzedColumns] = usePersistedState(
    "dashboard_analyzedColumns",
    []
  );
  const [currentStep, setCurrentStep] = usePersistedState(
    "dashboard_currentStep",
    1
  );
  const [filePath, setFilePath] = usePersistedState(
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
  const [fixMode, setFixMode] = usePersistedState(
    "dashboard_fixMode",
    "categorical"
  );
  const [correctedFilePath, setCorrectedFilePath] = usePersistedState(
    "dashboard_correctedFilePath",
    ""
  );
  const [visualizationKey, setVisualizationKey] = usePersistedState(
    "dashboard_visualizationKey",
    0
  );

  // State declarations removed as they were duplicated

  // Prefer selected dataset for downstream steps
  const workingFilePath = useMemo(
    () => selectedFilePath || filePath,
    [selectedFilePath, filePath]
  );

  // Target column will be selected manually by the user

  const pct = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);

  if (!workingFilePath && currentStep > 1) {
    // Guide users back to upload if they landed here without a file
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <h2 className="text-lg font-semibold mb-2">No dataset selected</h2>
            <p className="text-sm mb-4">
              Go back to the Home page and upload a dataset to begin.
            </p>
            <Link
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              to="/"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const StepHeader = () => (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">
              Dashboard
            </h1>
            <div className="text-xs text-slate-600 mt-1">
              File:{" "}
              <span className="font-mono">{workingFilePath || "(none)"}</span>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              Home
            </Link>
            <Link
              to="/report"
              className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              Reports
            </Link>
          </nav>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2 w-full rounded bg-slate-200">
            <div
              className="h-2 rounded bg-blue-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-6 text-[11px] text-slate-600">
            {STEPS.map((label, i) => {
              const stepNum = i + 1;
              const active = stepNum === currentStep;
              const done = stepNum < currentStep;
              return (
                <div
                  key={label}
                  className={`flex items-center gap-2 ${
                    active
                      ? "text-blue-700"
                      : done
                      ? "text-slate-800"
                      : "text-slate-500"
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold border ${
                      done
                        ? "bg-blue-600 text-white border-blue-600"
                        : active
                        ? "border-blue-600 text-blue-600"
                        : "border-slate-300"
                    }`}
                  >
                    {stepNum}
                  </span>
                  <span className="truncate">{label}</span>
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
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <StepHeader />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Step 1: Preview */}
        {currentStep === 1 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <DatasetPreview
              filePath={workingFilePath}
              onNext={({ columns: cols }) => {
                // Reset all column-related states when loading new data
                setColumns(cols || []);
                setSelectedColumns([]);
                setCategorical([]);
                setContinuous([]);
                setPreviousColumns([]);
                setBiasSummary(null);
                setSkewnessResults(null);
                setCurrentStep(2);
              }}
            />
          </section>
        )}

        {/* Step 2: Target Column Selection */}
        {currentStep === 2 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <FeatureSelector
              filePath={workingFilePath}
              columns={columns}
              initialSelected={selectedColumns}
              onSelect={({ features }) => {
                const oldSelected = new Set(selectedColumns || []);
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
                // Clear corrected file path when changing columns
                setCorrectedFilePath("");

                // Clear target column if it's no longer in selected columns
                if (targetColumn && !newSelected.has(targetColumn)) {
                  setTargetColumn("");
                }

                setCurrentStep(3);
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(1)}
              onNext={() => setCurrentStep(3)}
              nextDisabled={!selectedColumns.length}
            />
          </section>
        )}

        {/* Step 3: Column Type Classification */}
        {currentStep === 3 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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

                // Clear corrected file path when column types change
                setCorrectedFilePath("");

                // Clear target column if it's no longer categorical or if it changed type
                if (targetColumn && !newCatSet.has(targetColumn)) {
                  setTargetColumn("");
                }

                setCurrentStep(4);
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(2)}
              onNext={() => setCurrentStep(4)}
              nextDisabled={!categorical.length && !continuous.length}
            />
          </section>
        )}

        {/* Step 4: Bias Detection */}
        {currentStep === 4 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <BiasDetection
              filePath={workingFilePath}
              categorical={categorical}
              continuous={continuous}
              initialResults={biasSummary}
              initialSkewnessResults={skewnessResults}
              removedColumns={[]}
              onFix={({ results, fromButton }) => {
                if (!results) return;
                // Merge new results with existing ones
                setBiasSummary((prevResults) => ({
                  ...prevResults,
                  ...results,
                }));
                setFixMode("categorical");

                // Add newly analyzed columns to analyzedColumns
                const newlyAnalyzed = Object.keys(results);
                setAnalyzedColumns((prev) => {
                  const newSet = new Set([...prev, ...newlyAnalyzed]);
                  return Array.from(newSet);
                });

                // Only navigate when explicitly clicking the Fix button
                if (fromButton) {
                  setCurrentStep(5);
                }
              }}
              onSkewFix={({ skewnessResults: skewResults, fromButton }) => {
                if (!skewResults) return;
                // Merge new skewness results with existing ones
                setSkewnessResults((prevResults) => ({
                  ...prevResults,
                  ...skewResults,
                }));
                setFixMode("skewness");

                // Add newly analyzed columns to analyzedColumns
                const newlyAnalyzed = Object.keys(skewResults);
                setAnalyzedColumns((prev) => {
                  const newSet = new Set([...prev, ...newlyAnalyzed]);
                  return Array.from(newSet);
                });

                // Only navigate when explicitly clicking the Fix button
                if (fromButton) {
                  setCurrentStep(5);
                }
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(3)}
              onNext={() => setCurrentStep(5)}
              nextDisabled={!categorical.length && !continuous.length}
            />
          </section>
        )}

        {/* Step 5: Bias Fix */}
        {currentStep === 5 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {fixMode === "categorical" ? (
              <>
                <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Choose Target Column
                    </h2>
                    <p className="text-xs text-slate-600">
                      Pick a categorical column to apply correction.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">Target</label>
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      value={targetColumn}
                      onChange={(e) => {
                        const newTarget = e.target.value;
                        setTargetColumn(newTarget);
                        // Clear corrected file path when target changes
                        // This forces re-generation of visualization
                        setCorrectedFilePath("");
                        setVisualizationKey((prev) => prev + 1);
                      }}
                    >
                      <option value="" disabled>
                        Select column
                      </option>
                      {(categorical || []).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <BiasFixSandbox
                  filePath={workingFilePath}
                  targetColumn={targetColumn}
                  onFixComplete={(correctedPath) => {
                    setCorrectedFilePath(correctedPath);
                    setVisualizationKey((prev) => prev + 1);
                  }}
                />
              </>
            ) : (
              <SkewnessFixSandbox
                filePath={workingFilePath}
                continuous={continuous}
                skewnessResults={skewnessResults || {}}
                onFixComplete={(correctedPath) => {
                  setCorrectedFilePath(correctedPath);
                  setVisualizationKey((prev) => prev + 1);
                }}
              />
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                onClick={() => setCurrentStep(4)}
              >
                Back
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => setCurrentStep(6)}
                disabled={fixMode === "categorical" ? !targetColumn : false}
              >
                Next
              </button>
            </div>
          </section>
        )}

        {/* Step 6: Visualization */}
        {currentStep === 6 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {!correctedFilePath && fixMode === "categorical" && (
              <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
                Please apply bias correction in the previous step before viewing
                visualization.
              </div>
            )}
            <Visualization
              key={`viz-${visualizationKey}-${targetColumn}`}
              mode={fixMode === "skewness" ? "continuous" : "categorical"}
              beforePath={workingFilePath}
              afterPath={correctedFilePath || "corrected/corrected_dataset.csv"}
              targetColumn={
                fixMode === "categorical" ? targetColumn : undefined
              }
              continuous={fixMode === "skewness" ? continuous : undefined}
            />
            <NavButtons
              onPrev={() => setCurrentStep(5)}
              onNext={() => setCurrentStep(6)}
              nextDisabled
            />
          </section>
        )}
      </main>
    </div>
  );
}
