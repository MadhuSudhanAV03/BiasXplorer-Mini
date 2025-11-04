import React, { useMemo, useState } from "react";
import BiasFixSandbox from "./BiasFixSandbox";
import SkewnessFixSandbox from "./SkewnessFixSandbox";
import Spinner from "./Spinner";

export default function UnifiedBiasFix({
  filePath,
  categorical = [],
  continuous = [],
  biasResults = {},
  skewnessResults = {},
  columns = [],
  onFixComplete,
  selectedBiasColumns = [],
  selectedSkewnessColumns = [],
}) {
  const [biasState, setBiasState] = useState(null);
  const [skewnessState, setSkewnessState] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  // Filter categorical columns that need fixing (Moderate or Severe)
  const categoricalNeedingFix = useMemo(() => {
    return categorical.filter((col) => {
      const info = biasResults[col];
      return info && ["Moderate", "Severe"].includes(info.severity);
    });
  }, [categorical, biasResults]);

  // Filter continuous columns that need fixing (|skewness| > 0.5)
  const continuousNeedingFix = useMemo(() => {
    return continuous.filter((col) => {
      const info = skewnessResults[col];
      const skewValue = info?.skewness;
      return (
        skewValue !== null &&
        skewValue !== undefined &&
        Math.abs(skewValue) > 0.5
      );
    });
  }, [continuous, skewnessResults]);

  const hasCategoricalIssues = categoricalNeedingFix.length > 0;
  const hasSkewnessIssues = continuousNeedingFix.length > 0;

  // Filter selected columns to only include those that need fixing
  const filteredBiasColumns = useMemo(() => {
    return selectedBiasColumns.filter((col) =>
      categoricalNeedingFix.includes(col)
    );
  }, [selectedBiasColumns, categoricalNeedingFix]);

  const filteredSkewnessColumns = useMemo(() => {
    return selectedSkewnessColumns.filter((col) =>
      continuousNeedingFix.includes(col)
    );
  }, [selectedSkewnessColumns, continuousNeedingFix]);

  const handleUnifiedApply = async () => {
    setIsApplying(true);

    try {
      // Apply categorical fixes first if any selected
      if (biasState?.selectedColumns?.size > 0 && biasState?.handleApplyClick) {
        await biasState.handleApplyClick();
      }

      // Then apply skewness fixes if any selected
      if (skewnessState?.selectedColumns?.size > 0 && skewnessState?.applyFix) {
        await skewnessState.applyFix();
      }
    } catch (error) {
      console.error("Error applying fixes:", error);
    } finally {
      setIsApplying(false);
    }
  };

  const totalSelected =
    (biasState?.selectedColumns?.size || 0) +
    (skewnessState?.selectedColumns?.size || 0);
  const canApplyUnified = !isApplying && totalSelected > 0 && filePath;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Bias Fix</h2>
        <p className="text-sm text-slate-600 mt-1">
          Apply corrections to categorical imbalance and continuous skewness
          issues
        </p>
      </div>

      {!hasCategoricalIssues && !hasSkewnessIssues && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold">No issues detected!</span>
          </div>
          <p className="mt-2">
            All columns are clean. No categorical imbalance or skewness
            corrections needed.
          </p>
        </div>
      )}

      {/* Categorical Imbalance Fix Section */}
      {hasCategoricalIssues && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-amber-900">
              Imbalance Fix (Categorical)
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Fix class imbalance in categorical columns (
              {categoricalNeedingFix.length} column
              {categoricalNeedingFix.length !== 1 ? "s" : ""} need fixing)
            </p>
          </div>
          <BiasFixSandbox
            filePath={filePath}
            categorical={categoricalNeedingFix}
            biasResults={biasResults}
            columns={columns}
            onFixComplete={onFixComplete}
            initialSelectedColumns={filteredBiasColumns}
            hideApplyButton={true}
            onStateChange={setBiasState}
          />
        </div>
      )}

      {/* Continuous Skewness Fix Section */}
      {hasSkewnessIssues && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-blue-900">
              Skewness Fix (Continuous)
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Fix skewness in continuous columns ({continuousNeedingFix.length}{" "}
              column
              {continuousNeedingFix.length !== 1 ? "s" : ""} need fixing)
            </p>
          </div>
          <SkewnessFixSandbox
            filePath={filePath}
            continuous={continuousNeedingFix}
            skewnessResults={skewnessResults}
            onFixComplete={onFixComplete}
            initialSelectedColumns={filteredSkewnessColumns}
            hideApplyButton={true}
            onStateChange={setSkewnessState}
          />
        </div>
      )}

      {/* Unified Apply Button */}
      {(hasCategoricalIssues || hasSkewnessIssues) && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={handleUnifiedApply}
            disabled={!canApplyUnified}
            className="inline-flex items-center rounded-md bg-blue-600 px-8 py-4 text-white text-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {isApplying ? (
              <>
                <Spinner />
                <span className="ml-2">Applying Fixes...</span>
              </>
            ) : (
              <>
                Apply All Fixes
                {totalSelected > 0 && (
                  <span className="ml-2 bg-blue-500 px-2 py-1 rounded text-sm">
                    {totalSelected} column{totalSelected !== 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
