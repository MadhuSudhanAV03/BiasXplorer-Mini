"""Continuous data skewness correction methods."""
import pandas as pd
import numpy as np
from typing import Literal
from sklearn.preprocessing import QuantileTransformer, PowerTransformer


class ContinuousTransformer:
    """Handles skewness correction transformations."""

    @staticmethod
    def apply_square_root(series: pd.Series) -> pd.Series:
        """Apply square root transformation (for small positive skew)."""
        return pd.Series(np.sqrt(series), index=series.index)

    @staticmethod
    def apply_log(series: pd.Series) -> pd.Series:
        """Apply log transformation (for medium positive skew)."""
        return pd.Series(np.log1p(series), index=series.index)

    @staticmethod
    def apply_square_power(series: pd.Series) -> pd.Series:
        """Apply squared power transformation (for small negative skew)."""
        return pd.Series(np.power(series, 2), index=series.index)

    @staticmethod
    def apply_cube_power(series: pd.Series) -> pd.Series:
        """Apply cubed power transformation (for medium negative skew)."""
        return pd.Series(np.power(series, 3), index=series.index)

    @staticmethod
    def apply_yeo_johnson(df: pd.DataFrame, col: str) -> pd.DataFrame:
        """Apply Yeo-Johnson transformation (for severe skew)."""
        pt = PowerTransformer(method='yeo-johnson')
        df[col] = pt.fit_transform(df[[col]])
        return df

    @staticmethod
    def apply_quantile_transformer(df: pd.DataFrame, col: str, output_distribution: Literal['uniform', 'normal'] = 'normal', random_state: int = 42) -> pd.DataFrame:
        """Apply Quantile Transformer (for extreme skew)."""
        qt = QuantileTransformer(
            output_distribution=output_distribution, random_state=random_state)
        df[col] = qt.fit_transform(df[[col]])
        return df

    @staticmethod
    def get_transformation_method(skew_value: float) -> str:
        """
        Determine appropriate transformation method based on skewness value.

        Args:
            skew_value: Skewness value

        Returns:
            String name of the recommended method
        """
        if abs(skew_value) <= 0.5:
            return "None (already symmetric)"
        elif skew_value > 0.5 and skew_value <= 1:
            return "Square Root"
        elif skew_value > 1 and skew_value <= 2:
            return "Log Transformation"
        elif skew_value < -0.5 and skew_value >= -1:
            return "Squared Power"
        elif skew_value < -1 and skew_value >= -2:
            return "Cubed Power"
        elif (skew_value > 2 and skew_value <= 3) or (skew_value < -2 and skew_value >= -3):
            return "Yeo-Johnson"
        else:
            return "Quantile Transformer"

    @staticmethod
    def apply_transformation(df: pd.DataFrame, col: str, skew_value: float) -> pd.DataFrame:
        """
        Apply appropriate transformation based on skewness value.

        Args:
            df: DataFrame
            col: Column name to transform
            skew_value: Skewness value

        Returns:
            Transformed DataFrame
        """
        if abs(skew_value) <= 0.5:
            return df
        elif skew_value > 0.5 and skew_value <= 1:
            df[col] = ContinuousTransformer.apply_square_root(df[col])
        elif skew_value > 1 and skew_value <= 2:
            df[col] = ContinuousTransformer.apply_log(df[col])
        elif skew_value < -0.5 and skew_value >= -1:
            df[col] = ContinuousTransformer.apply_square_power(df[col])
        elif skew_value < -1 and skew_value >= -2:
            df[col] = ContinuousTransformer.apply_cube_power(df[col])
        elif (skew_value > 2 and skew_value <= 3) or (skew_value < -2 and skew_value >= -3):
            df = ContinuousTransformer.apply_yeo_johnson(df, col)
        else:
            df = ContinuousTransformer.apply_quantile_transformer(df, col)

        return df
