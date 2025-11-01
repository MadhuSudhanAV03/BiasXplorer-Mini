"""Bias detection service for categorical columns."""
import pandas as pd
from typing import Dict, List, Any


class BiasDetectionService:
    """Service for detecting class imbalance in categorical data."""

    @staticmethod
    def detect_imbalance(df: pd.DataFrame, categorical_columns: List[str]) -> Dict[str, Any]:
        """
        Detect class imbalance for given categorical columns.

        Args:
            df: Input DataFrame
            categorical_columns: List of categorical column names

        Returns:
            Dictionary mapping column names to imbalance statistics
        """
        result = {}
        df_columns = set(df.columns)

        for col in categorical_columns:
            col_entry = {}

            if col not in df_columns:
                col_entry["severity"] = "N/A"
                col_entry["note"] = "Column not found"
                result[col] = col_entry
                continue

            series = df[col].dropna()
            if series.empty:
                col_entry["severity"] = "N/A"
                col_entry["note"] = "No data"
                result[col] = col_entry
                continue

            # Compute normalized distribution
            dist = series.value_counts(normalize=True).to_dict()
            dist_str = {str(k): float(round(v, 6)) for k, v in dist.items()}

            # Calculate imbalance ratio
            if len(dist_str) == 1:
                ratio = 0.0  # Single class = maximum imbalance
            else:
                majority = max(dist_str.values())
                minority = min(dist_str.values())
                ratio = (minority / majority) if majority > 0 else 0.0

            # Assign severity
            if ratio >= 0.5:
                severity = "Low"
            elif ratio >= 0.2:
                severity = "Moderate"
            else:
                severity = "Severe"

            # Merge distribution and severity
            col_entry.update(dist_str)
            col_entry["severity"] = severity
            result[col] = col_entry

        return result

    @staticmethod
    def get_class_distribution(df: pd.DataFrame, target_col: str) -> Dict[str, Any]:
        """
        Get class distribution statistics for a target column.

        Args:
            df: Input DataFrame
            target_col: Target column name

        Returns:
            Dictionary with counts, distribution, and total
        """
        y = df[target_col].astype(str)

        counts = y.value_counts(dropna=False).to_dict()
        distribution = y.value_counts(
            normalize=True, dropna=False).round(6).astype(float).to_dict()
        total = int(len(y))

        return {
            "counts": counts,
            "distribution": distribution,
            "total": total
        }
