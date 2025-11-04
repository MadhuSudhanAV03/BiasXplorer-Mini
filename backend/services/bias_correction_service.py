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
        threshold: Optional[float] = None,
        categorical_columns: Optional[list] = None
    ) -> tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Apply bias correction to a DataFrame.

        Args:
            df: Input DataFrame
            target_col: Target column name
            method: Correction method (oversample/undersample/smote/reweight)
            threshold: Optional threshold for sampling strategy
            categorical_columns: Optional list of categorical column names for SMOTE-NC

        Returns:
            Tuple of (corrected_dataframe, metadata_dict)
        """
        # Determine sampling strategy
        sampling_strategy = 'auto'
        if threshold is not None:
            try:
                thr = float(threshold)
                y = df[target_col].astype(str)
                nunique = y.nunique(dropna=True)

                if 0 < thr <= 1:
                    if nunique == 2:
                        # Binary class: use threshold directly
                        sampling_strategy = thr
                    elif nunique > 2 and method in ["oversample", "smote"]:
                        # Multi-class oversampling: bring each class toward balance
                        # threshold controls how aggressively to balance:
                        # - 1.0 = perfect balance (all classes equal to majority)
                        # - 0.5 = bring each class halfway toward majority
                        # - Preserves relative ordering of classes
                        value_counts = y.value_counts().sort_values(ascending=False)
                        majority_count = value_counts.iloc[0]

                        sampling_dict = {}
                        for cls, count in value_counts.items():
                            if count < majority_count:
                                # Calculate how much to increase this class
                                # target = current + (majority - current) * threshold
                                target_count = int(
                                    count + (majority_count - count) * thr)
                                if target_count > count:
                                    sampling_dict[cls] = target_count

                        if sampling_dict:
                            sampling_strategy = sampling_dict
                    elif nunique > 2 and method == "undersample":
                        # Multi-class undersampling: bring majority down proportionally
                        value_counts = y.value_counts()
                        minority_count = value_counts.min()

                        sampling_dict = {}
                        for cls, count in value_counts.items():
                            # Calculate target: minority / threshold
                            # If threshold = 0.5, minority class becomes 0.5 of target majority
                            target_count = int(minority_count / thr)
                            # Only undersample classes above target
                            if count > target_count:
                                sampling_dict[cls] = target_count

                        if sampling_dict:
                            sampling_strategy = sampling_dict
            except Exception as e:
                print(
                    f"[BiasCorrectionService] Error calculating sampling strategy: {e}")
                pass

        metadata = {
            "method": method,
            "sampling_strategy": str(sampling_strategy) if not isinstance(sampling_strategy, (str, float)) else (sampling_strategy if isinstance(sampling_strategy, float) else "auto")
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
                df, target_col, sampling_strategy, categorical_columns=categorical_columns)
            if categorical_columns:
                metadata["categorical_columns"] = categorical_columns
            return df_corrected, metadata

        else:
            raise ValueError(f"Unsupported method: {method}")
