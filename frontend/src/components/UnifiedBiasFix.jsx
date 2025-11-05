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
  initialBiasFixResult = null, // Persisted result from parent
  initialSkewnessFixResult = null, // Persisted result from parent
  onResultsChange, // Callback to notify parent of result changes
  initialBiasSelectedColumns = [], // Persisted selected bias columns
  initialSkewnessSelectedColumns = [], // Persisted selected skewness columns
  onSelectedColumnsChange, // Callback to notify parent of selection changes
}) {
  const [biasState, setBiasState] = useState(null);
  const [skewnessState, setSkewnessState] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [lastCorrectedPath, setLastCorrectedPath] = useState("");
  const [currentWorkingPath, setCurrentWorkingPath] = useState(filePath);
  const [fixesCompleted, setFixesCompleted] = useState(false); // Track if fixes are done

  // Use results from props (persisted by parent)
  const biasFixResult = initialBiasFixResult;
  const skewnessFixResult = initialSkewnessFixResult;

  // Use refs to maintain latest results for callbacks (prevents stale closures)
  const biasFixResultRef = useRef(initialBiasFixResult);
  const skewnessFixResultRef = useRef(initialSkewnessFixResult);

  // Keep refs in sync with props
  useEffect(() => {
    biasFixResultRef.current = initialBiasFixResult;
  }, [initialBiasFixResult]);

  useEffect(() => {
    skewnessFixResultRef.current = initialSkewnessFixResult;
  }, [initialSkewnessFixResult]);

  // Check if any fixes have been applied previously (for result visibility)
  const hasAppliedFixes = !!biasFixResult || !!skewnessFixResult;

  // Debug logging
  useEffect(() => {
    console.log("[UnifiedBiasFix] State update:", {
      biasFixResult,
      skewnessFixResult,
      hasAppliedFixes,
    });
  }, [biasFixResult, skewnessFixResult, hasAppliedFixes]);

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

  // Memoize selected columns arrays to prevent unnecessary updates
  const biasSelectedArray = useMemo(() => {
    return biasState?.selectedColumns
      ? Array.from(biasState.selectedColumns).sort()
      : [];
  }, [biasState?.selectedColumns]);

  const skewnessSelectedArray = useMemo(() => {
    return skewnessState?.selectedColumns
      ? Array.from(skewnessState.selectedColumns).sort()
      : [];
  }, [skewnessState?.selectedColumns]);

  // Track selected columns and notify parent when they change
  // Use JSON.stringify for stable comparison
  const biasSelectedKey = JSON.stringify(biasSelectedArray);
  const skewnessSelectedKey = JSON.stringify(skewnessSelectedArray);

  useEffect(() => {
    if (biasSelectedArray.length > 0 && onSelectedColumnsChange) {
      onSelectedColumnsChange({ biasSelectedColumns: biasSelectedArray });
    }
  }, [biasSelectedKey, onSelectedColumnsChange]); // Use string key for stable comparison

  useEffect(() => {
    if (skewnessSelectedArray.length > 0 && onSelectedColumnsChange) {
      onSelectedColumnsChange({
        skewnessSelectedColumns: skewnessSelectedArray,
      });
    }
  }, [skewnessSelectedKey, onSelectedColumnsChange]); // Use string key for stable comparison

  // Filter categorical columns that need fixing (Moderate or Severe)
  const categoricalNeedingFix = useMemo(() => {
    if (!biasResults) return [];
    return categorical.filter((col) => {
      const info = biasResults[col];
      return info && ["Moderate", "Severe"].includes(info.severity);
    });
  }, [categorical, biasResults]);

  // Filter continuous columns that need fixing (|skewness| > 0.5)
  const continuousNeedingFix = useMemo(() => {
    if (!skewnessResults) return [];
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
  // Use persisted selections if available (when navigating back), otherwise use detection selections
  const filteredBiasColumns = useMemo(() => {
    const columnsToUse =
      initialBiasSelectedColumns.length > 0
        ? initialBiasSelectedColumns
        : selectedBiasColumns;
    return columnsToUse.filter((col) => categoricalNeedingFix.includes(col));
  }, [selectedBiasColumns, categoricalNeedingFix, initialBiasSelectedColumns]);

  const filteredSkewnessColumns = useMemo(() => {
    const columnsToUse =
      initialSkewnessSelectedColumns.length > 0
        ? initialSkewnessSelectedColumns
        : selectedSkewnessColumns;
    return columnsToUse.filter((col) => continuousNeedingFix.includes(col));
  }, [
    selectedSkewnessColumns,
    continuousNeedingFix,
    initialSkewnessSelectedColumns,
  ]);

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
        biasResolverRef.current = null;
      }

      // Then apply skewness fixes if any selected
      if (skewnessState?.selectedColumns?.size > 0 && skewnessState?.applyFix) {
        const skewColumns = Array.from(skewnessState.selectedColumns);
        console.log(
          "[UnifiedBiasFix] Applying skewness fixes for:",
          skewColumns
        );

        // Update currentWorkingPath if we have a categorical corrected path
        if (finalCorrectedPath) {
          console.log(
            "[UnifiedBiasFix] Updating working path for skewness fix:",
            finalCorrectedPath
          );
          setCurrentWorkingPath(finalCorrectedPath);
          // Wait for React to propagate the state update
          // This ensures the SkewnessFixSandbox ref gets the updated path
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

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
  const handleBiasFixComplete = (correctedPath, result) => {
    console.log("[UnifiedBiasFix] Bias fix completed:", correctedPath);
    console.log("[UnifiedBiasFix] Bias fix result:", result);
    setLastCorrectedPath(correctedPath);
    setCurrentWorkingPath(correctedPath); // Update working path for next fix

    // Update ref with new result
    if (result) {
      console.log("[UnifiedBiasFix] Updating biasFixResultRef to:", result);
      biasFixResultRef.current = result;
    }

    // Notify parent to persist the result (use ref to get latest skewness result)
    if (result && onResultsChange) {
      console.log("[UnifiedBiasFix] Calling onResultsChange with:", {
        biasFixResult: result,
        skewnessFixResult: skewnessFixResultRef.current,
      });
      onResultsChange({
        biasFixResult: result,
        skewnessFixResult: skewnessFixResultRef.current,
      });
    }

    // Resolve the promise if it exists
    if (biasResolverRef.current) {
      biasResolverRef.current(correctedPath);
    }
  };

  // Handler to intercept skewness fix completion
  const handleSkewnessFixComplete = (correctedPath, result) => {
    console.log("[UnifiedBiasFix] Skewness fix completed:", correctedPath);
    console.log("[UnifiedBiasFix] Skewness fix result:", result);
    setLastCorrectedPath(correctedPath);
    setCurrentWorkingPath(correctedPath);

    // Update ref with new result
    if (result) {
      console.log("[UnifiedBiasFix] Updating skewnessFixResultRef to:", result);
      skewnessFixResultRef.current = result;
    }

    // Notify parent to persist the result (use ref to get latest bias result)
    if (result && onResultsChange) {
      console.log("[UnifiedBiasFix] Calling onResultsChange with:", {
        biasFixResult: biasFixResultRef.current,
        skewnessFixResult: result,
      });
      console.log(
        "[UnifiedBiasFix] Current biasFixResultRef.current:",
        biasFixResultRef.current
      );
      onResultsChange({
        biasFixResult: biasFixResultRef.current,
        skewnessFixResult: result,
      });
    }

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
    <div className="space-y-6 animate-fadeInUp">
      {/* Page Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="text-4xl animate-float">🛠️</div>
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Bias Correction</h2>
          <p className="text-sm text-slate-600 mt-1">
            Apply advanced techniques to fix categorical imbalance and
            continuous skewness
          </p>
        </div>
      </div>

      {!hasCategoricalIssues && !hasSkewnessIssues && (
        <div className="rounded-3xl bg-gradient-to-r from-green-50 to-emerald-50 p-8 border-2 border-green-300 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="text-6xl animate-bounce-slow">✅</div>
            <div>
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                No Issues Detected!
              </h3>
              <p className="text-green-700">
                Your dataset appears to be well-balanced. No bias corrections
                are needed at this time.
              </p>
            </div>
          </div>
        </div>
      )}

      {!hasCategoricalIssues && !hasSkewnessIssues && (
        <div className="hidden rounded-md bg-green-50 p-4 text-sm text-green-800 border border-green-200">
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
        <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-8 shadow-2xl card-hover-lift animate-scaleIn">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-4xl">📊</div>
            <div>
              <h3 className="text-2xl font-bold text-amber-900">
                Categorical Imbalance Fix
              </h3>
              <p className="text-sm text-amber-700 mt-1 flex items-center gap-2">
                <span className="px-3 py-1 bg-amber-200 text-amber-900 rounded-full font-semibold">
                  {categoricalNeedingFix.length} column
                  {categoricalNeedingFix.length !== 1 ? "s" : ""} need fixing
                </span>
              </p>
            </div>
          </div>
          <BiasFixSandbox
            filePath={filePath}
            categorical={categoricalNeedingFix}
            biasResults={biasResults}
            columns={columns}
            onFixComplete={handleBiasFixComplete}
            initialSelectedColumns={filteredBiasColumns}
            hideApplyButton={true}
            hideResults={!hasAppliedFixes} // Show results if any fixes have been applied
            initialResult={biasFixResult} // Pass stored result for persistence
            onStateChange={setBiasState}
          />
        </div>
      )}

      {/* Continuous Skewness Fix Section */}
      {hasSkewnessIssues && (
        <div className="rounded-3xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 shadow-2xl card-hover-lift animate-scaleIn stagger-1">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-4xl">📈</div>
            <div>
              <h3 className="text-2xl font-bold text-blue-900">
                Continuous Skewness Fix
              </h3>
              <p className="text-sm text-blue-700 mt-1 flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-200 text-blue-900 rounded-full font-semibold">
                  {continuousNeedingFix.length} column
                  {continuousNeedingFix.length !== 1 ? "s" : ""} need fixing
                </span>
              </p>
            </div>
          </div>
          <SkewnessFixSandbox
            filePath={currentWorkingPath}
            continuous={continuousNeedingFix}
            skewnessResults={skewnessResults}
            onFixComplete={handleSkewnessFixComplete}
            initialSelectedColumns={filteredSkewnessColumns}
            hideApplyButton={true}
            hideResults={!hasAppliedFixes} // Show results if any fixes have been applied
            initialResult={skewnessFixResult} // Pass stored result for persistence
            onStateChange={setSkewnessState}
          />
        </div>
      )}

      {/* Unified Apply Button */}
      {(hasCategoricalIssues || hasSkewnessIssues) && (
        <div className="flex justify-center mt-8 animate-fadeInUp stagger-2">
          <button
            type="button"
            onClick={handleUnifiedApply}
            disabled={!canApplyUnified}
            className="group relative inline-flex items-center gap-4 rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 px-12 py-6 text-white text-xl font-bold hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-2xl hover:shadow-green-500/50 card-hover-lift animate-pulseGlow"
          >
            {isApplying ? (
              <>
                <Spinner className="h-6 w-6" />
                <span>Applying Fixes...</span>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
              </>
            ) : (
              <>
                <span className="text-3xl">🚀</span>
                <span>Apply All Fixes</span>
                {totalSelected > 0 && (
                  <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-base font-bold border-2 border-white/30">
                    {totalSelected} column{totalSelected !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                  →
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
