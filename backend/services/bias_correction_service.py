"""Bias correction service for categorical columns."""
import pandas as pd
from typing import Dict, Any, Optional
from utils.transformers.categorical import CategoricalTransformer


class BiasCorrectionService:
    """Service for correcting class imbalance in categorical data."""

    VALID_METHODS = {"oversample", "undersample", "smote", "reweight"}

    @staticmethod
    def validate_method(method: str) -> bool:
        """Check if correction method is valid."""
        return method.lower() in BiasCorrectionService.VALID_METHODS

    @staticmethod
    def validate_target_column(df: pd.DataFrame, target_col: str) -> tuple[bool, Optional[str]]:
        """
        Validate that target column exists and is categorical.

        Returns:
            Tuple of (is_valid, error_message)
        """
        if target_col not in df.columns:
            return False, f"Target column '{target_col}' not found in dataset"

        y = df[target_col]
        nunique = y.nunique(dropna=True)
        is_categorical = (str(y.dtype) in (
            "object", "category", "bool")) or (nunique <= 20)

        if not is_categorical:
            return False, "Target column is not categorical"

        return True, None

    @staticmethod
    def apply_correction(
        df: pd.DataFrame,
        target_col: str,
        method: str,
        threshold: Optional[float] = None
    ) -> tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Apply bias correction to a DataFrame.

        Args:
            df: Input DataFrame
            target_col: Target column name
            method: Correction method (oversample/undersample/smote/reweight)
            threshold: Optional threshold for sampling strategy

        Returns:
            Tuple of (corrected_dataframe, metadata_dict)
        """
        # Determine sampling strategy
        sampling_strategy = 'auto'
        if threshold is not None:
            try:
                thr = float(threshold)
                y = df[target_col]
                nunique = y.nunique(dropna=True)
                if 0 < thr <= 1 and nunique == 2:
                    sampling_strategy = thr
            except Exception:
                pass

        metadata = {
            "method": method,
            "sampling_strategy": sampling_strategy if isinstance(sampling_strategy, float) else "auto"
        }

        # Apply correction based on method
        if method == "reweight":
            # Reweight doesn't modify the dataset
            y = df[target_col].astype(str)
            class_weights = CategoricalTransformer.compute_class_weights(y)
            metadata["class_weights"] = class_weights
            return df.copy(), metadata

        elif method == "oversample":
            df_corrected = CategoricalTransformer.oversample(
                df, target_col, sampling_strategy)
            return df_corrected, metadata

        elif method == "undersample":
            df_corrected = CategoricalTransformer.undersample(
                df, target_col, sampling_strategy)
            return df_corrected, metadata

        elif method == "smote":
            df_corrected = CategoricalTransformer.smote(
                df, target_col, sampling_strategy)
            return df_corrected, metadata

        else:
            raise ValueError(f"Unsupported method: {method}")
