"""Skewness correction service for continuous columns."""
import pandas as pd
from typing import Dict, Any, List
from utils.data_stats import compute_skewness
from utils.transformers.continuous import ContinuousTransformer


class SkewnessCorrectionService:
    """Service for correcting skewness in continuous data."""

    @staticmethod
    def correct_column(df: pd.DataFrame, column: str) -> Dict[str, Any]:
        """
        Correct skewness in a single column.
        
        Args:
            df: Input DataFrame (will be modified in place)
            column: Column name to correct
            
        Returns:
            Dictionary with transformation results
        """
        if column not in df.columns:
            return {
                "error": "Column not found",
                "original_skewness": None,
                "new_skewness": None,
                "method": None
            }

        try:
            # Compute original skewness
            original_series = df[column].copy()
            original_skewness = compute_skewness(original_series)

            if original_skewness is None:
                return {
                    "error": "Unable to compute skewness",
                    "original_skewness": None,
                    "new_skewness": None,
                    "method": None
                }

            # Determine and apply transformation
            method = ContinuousTransformer.get_transformation_method(original_skewness)
            
            if abs(original_skewness) <= 0.5:
                new_skewness = original_skewness
            else:
                df = ContinuousTransformer.apply_transformation(df, column, original_skewness)
                new_skewness = compute_skewness(df[column])

            return {
                "original_skewness": float(original_skewness),
                "new_skewness": float(new_skewness) if new_skewness is not None else None,
                "method": method
            }

        except Exception as e:
            return {
                "error": str(e),
                "original_skewness": None,
                "new_skewness": None,
                "method": None
            }

    @staticmethod
    def correct_multiple_columns(df: pd.DataFrame, columns: List[str]) -> tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Correct skewness in multiple columns.
        
        Args:
            df: Input DataFrame
            columns: List of column names to correct
            
        Returns:
            Tuple of (corrected_dataframe, transformation_results)
        """
        df_corrected = df.copy()
        transformations = {}
        
        for col in columns:
            result = SkewnessCorrectionService.correct_column(df_corrected, col)
            transformations[col] = result
        
        return df_corrected, transformations
