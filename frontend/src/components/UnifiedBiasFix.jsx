import React, { useMemo, useState, useEffect, useRef } from "react";
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
  onApplyingChange, // New prop to notify parent when applying state changes
}) {
  const [biasState, setBiasState] = useState(null);
  const [skewnessState, setSkewnessState] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [appliedBiasColumns, setAppliedBiasColumns] = useState([]);
  const [appliedSkewnessColumns, setAppliedSkewnessColumns] = useState([]);
  const [lastCorrectedPath, setLastCorrectedPath] = useState("");
  const [currentWorkingPath, setCurrentWorkingPath] = useState(filePath);
  const [fixesCompleted, setFixesCompleted] = useState(false); // Track if fixes are done

  // Use refs to store promise resolvers
  const biasResolverRef = useRef(null);
  const skewResolverRef = useRef(null);

  // Update currentWorkingPath when filePath changes
  useEffect(() => {
    setCurrentWorkingPath(filePath);
  }, [filePath]);

  // Notify parent when isApplying changes
  useEffect(() => {
    if (onApplyingChange) {
      onApplyingChange(isApplying);
    }
  }, [isApplying, onApplyingChange]);
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
    setFixesCompleted(false); // Reset completion state
    const fixedCategorical = [];
    const fixedContinuous = [];
    let finalCorrectedPath = "";

    try {
      // Apply categorical fixes first if any selected
      if (biasState?.selectedColumns?.size > 0 && biasState?.handleApplyClick) {
        const biasColumns = Array.from(biasState.selectedColumns);
        console.log(
          "[UnifiedBiasFix] Applying categorical fixes for:",
          biasColumns
        );

        // Create a promise that resolves when handleBiasFixComplete is called
        const biasPromise = new Promise((resolve) => {
          biasResolverRef.current = resolve;
        });

        await biasState.handleApplyClick();

        // Wait for the fix to complete and get the path
        const biasPath = await Promise.race([
          biasPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
          ),
        ]).catch((err) => {
          console.error("[UnifiedBiasFix] Bias fix timeout or error:", err);
          return null;
        });

        if (biasPath) {
          finalCorrectedPath = biasPath;
          console.log(
            "[UnifiedBiasFix] Got categorical corrected path:",
            finalCorrectedPath
          );
        }

        fixedCategorical.push(...biasColumns);
        setAppliedBiasColumns(biasColumns);
        biasResolverRef.current = null;
      }

      // Then apply skewness fixes if any selected
      if (skewnessState?.selectedColumns?.size > 0 && skewnessState?.applyFix) {
        const skewColumns = Array.from(skewnessState.selectedColumns);
        console.log(
          "[UnifiedBiasFix] Applying skewness fixes for:",
          skewColumns
        );

        // Create a promise that resolves when handleSkewnessFixComplete is called
        const skewPromise = new Promise((resolve) => {
          skewResolverRef.current = resolve;
        });

        await skewnessState.applyFix();

        // Wait for the fix to complete and get the path
        const skewPath = await Promise.race([
          skewPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
          ),
        ]).catch((err) => {
          console.error("[UnifiedBiasFix] Skewness fix timeout or error:", err);
          return null;
        });

        if (skewPath) {
          finalCorrectedPath = skewPath;
          console.log(
            "[UnifiedBiasFix] Got skewness corrected path:",
            finalCorrectedPath
          );
        }

        fixedContinuous.push(...skewColumns);
        setAppliedSkewnessColumns(skewColumns);
        skewResolverRef.current = null;
      }

      console.log("[UnifiedBiasFix] All fixes applied:", {
        categorical: fixedCategorical,
        continuous: fixedContinuous,
        finalPath: finalCorrectedPath,
      });

      // Mark fixes as completed
      setFixesCompleted(true);

      // Notify parent with the final corrected path and fixed columns
      if (onFixComplete && finalCorrectedPath) {
        console.log("[UnifiedBiasFix] Calling onFixComplete with:", {
          path: finalCorrectedPath,
          categorical: fixedCategorical,
          continuous: fixedContinuous,
        });
        onFixComplete(finalCorrectedPath, fixedCategorical, fixedContinuous);
      } else {
        console.warn(
          "[UnifiedBiasFix] Not calling onFixComplete - missing path or callback",
          {
            hasCallback: !!onFixComplete,
            path: finalCorrectedPath,
          }
        );
      }
    } catch (error) {
      console.error("Error applying fixes:", error);
      setFixesCompleted(false); // Reset on error
    } finally {
      setIsApplying(false);
    }
  };

  // Handler to intercept categorical fix completion
  const handleBiasFixComplete = (correctedPath) => {
    console.log("[UnifiedBiasFix] Bias fix completed:", correctedPath);
    setLastCorrectedPath(correctedPath);
    setCurrentWorkingPath(correctedPath); // Update working path for next fix

    // Resolve the promise if it exists
    if (biasResolverRef.current) {
      biasResolverRef.current(correctedPath);
    }
  };

  // Handler to intercept skewness fix completion
  const handleSkewnessFixComplete = (correctedPath) => {
    console.log("[UnifiedBiasFix] Skewness fix completed:", correctedPath);
    setLastCorrectedPath(correctedPath);
    setCurrentWorkingPath(correctedPath);

    // Resolve the promise if it exists
    if (skewResolverRef.current) {
      skewResolverRef.current(correctedPath);
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
            onFixComplete={handleBiasFixComplete}
            initialSelectedColumns={filteredBiasColumns}
            hideApplyButton={true}
            hideResults={!fixesCompleted} // Hide results until fixes are complete
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
            filePath={currentWorkingPath}
            continuous={continuousNeedingFix}
            skewnessResults={skewnessResults}
            onFixComplete={handleSkewnessFixComplete}
            initialSelectedColumns={filteredSkewnessColumns}
            hideApplyButton={true}
            hideResults={!fixesCompleted} // Hide results until fixes are complete
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
