import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import DatasetPreview from "../components/DatasetPreview";
import ColumnSelector from "../components/ColumnSelector";
import FeatureSelector from "../components/FeatureSelector";
import BiasDetection from "../components/BiasDetection";
import BiasFixSandbox from "../components/BiasFixSandbox";
import SkewnessFixSandbox from "../components/SkewnessFixSandbox";
import Visualization from "../components/Visualization";

const STEPS = [
  "Dataset Preview",
  "Column Selector",
  "Feature Selector",
  "Bias Detection",
  "Bias Fix",
  "Visualization",
];

export default function Dashboard() {
  const location = useLocation();
  const initialFilePath = location.state?.filePath || "";

  const [currentStep, setCurrentStep] = useState(1); // 1..6
  const [filePath, setFilePath] = useState(initialFilePath);
  const [columns, setColumns] = useState([]);
  const [categorical, setCategorical] = useState([]);
  const [continuous, setContinuous] = useState([]);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [biasSummary, setBiasSummary] = useState(null);
  const [skewnessResults, setSkewnessResults] = useState(null);
  const [targetColumn, setTargetColumn] = useState("");
  const [fixMode, setFixMode] = useState("categorical"); // "categorical" or "skewness"

  // Prefer selected dataset for downstream steps
  const workingFilePath = useMemo(
    () => selectedFilePath || filePath,
    [selectedFilePath, filePath]
  );

  // Auto-pick a target column with issues after bias detection (Moderate/Severe)
  useEffect(() => {
    if (!biasSummary) return;
    const entries = Object.entries(biasSummary);
    const problematic = entries.find(([, v]) =>
      ["Moderate", "Severe"].includes(v?.severity)
    );
    if (problematic) setTargetColumn(problematic[0]);
    else if (categorical?.length) setTargetColumn(categorical[0]);
  }, [biasSummary, categorical]);

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
                setColumns(cols || []);
                setCurrentStep(2);
              }}
            />
          </section>
        )}

        {/* Step 2: Column Selector */}
        {currentStep === 2 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <ColumnSelector
              filePath={workingFilePath}
              columns={columns}
              onSubmit={({ categorical: cat, continuous: cont }) => {
                setCategorical(cat || []);
                setContinuous(cont || []);
                setCurrentStep(3);
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(1)}
              onNext={() => setCurrentStep(3)}
              nextDisabled={!columns.length}
            />
          </section>
        )}

        {/* Step 3: Feature Selector */}
        {currentStep === 3 && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <FeatureSelector
              filePath={workingFilePath}
              columns={columns}
              onSelect={({ features, response }) => {
                if (response?.selected_file_path)
                  setSelectedFilePath(response.selected_file_path);
                setCurrentStep(4);
              }}
            />
            <NavButtons
              onPrev={() => setCurrentStep(2)}
              onNext={() => setCurrentStep(4)}
              nextDisabled={!columns.length}
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
              onFix={({ results }) => {
                setBiasSummary(results || {});
                setFixMode("categorical");
                setCurrentStep(5);
              }}
              onSkewFix={({ skewnessResults: skewResults }) => {
                setSkewnessResults(skewResults || {});
                setFixMode("skewness");
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
                      onChange={(e) => setTargetColumn(e.target.value)}
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
                />
              </>
            ) : (
              <SkewnessFixSandbox
                filePath={workingFilePath}
                continuous={continuous}
                skewnessResults={skewnessResults || {}}
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
            <Visualization
              mode={fixMode === "skewness" ? "continuous" : "categorical"}
              beforePath={workingFilePath}
              afterPath={"corrected/corrected_dataset.csv"}
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
