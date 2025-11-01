"""Skewness detection service for continuous columns."""
import pandas as pd
from typing import Dict, Any
from utils.data_stats import compute_skewness


class SkewnessDetectionService:
    """Service for detecting skewness in continuous data."""

    @staticmethod
    def detect_skewness(df: pd.DataFrame, column: str) -> Dict[str, Any]:
        """
        Detect skewness in a specific column.
        
        Args:
            df: Input DataFrame
            column: Column name to analyze
            
        Returns:
            Dictionary with skewness statistics
            
        Raises:
            ValueError: If column not found or insufficient data
        """
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in dataset")
        
        series = df[column]
        n_nonnull = series.notna().sum()
        
        skewness = compute_skewness(series)
        
        return {
            "column": column,
            "skewness": skewness,
            "n_nonnull": int(n_nonnull),
            "message": "ok"
        }

    @staticmethod
    def interpret_skewness(skewness: float) -> Dict[str, str]:
        """
        Interpret skewness value and return classification.
        
        Args:
            skewness: Skewness value
            
        Returns:
            Dictionary with interpretation details
        """
        if skewness is None:
            return {
                "label": "N/A",
                "severity": "none",
                "description": "Unable to compute skewness"
            }
        
        abs_skew = abs(skewness)
        
        if abs_skew <= 0.5:
            return {
                "label": "Symmetric",
                "severity": "low",
                "description": "Distribution is approximately symmetric"
            }
        elif abs_skew <= 1:
            direction = "right" if skewness > 0 else "left"
            return {
                "label": f"Slightly {direction}-skewed",
                "severity": "moderate",
                "description": f"Distribution shows slight {direction} skew"
            }
        elif abs_skew <= 2:
            direction = "right" if skewness > 0 else "left"
            return {
                "label": f"Moderately {direction}-skewed",
                "severity": "high",
                "description": f"Distribution shows moderate {direction} skew"
            }
        else:
            direction = "right" if skewness > 0 else "left"
            return {
                "label": f"Highly {direction}-skewed",
                "severity": "severe",
                "description": f"Distribution is highly {direction}-skewed"
            }
