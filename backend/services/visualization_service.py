"""Visualization service for generating charts."""
import base64
import io
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List
from utils.data_stats import compute_skewness


class VisualizationService:
    """Service for generating visualization charts."""

    @staticmethod
    def plot_categorical_distribution(series: pd.Series, title: str) -> str:
        """
        Create a bar plot of categorical distribution.
        
        Args:
            series: Pandas Series with categorical data
            title: Chart title
            
        Returns:
            Base64-encoded PNG image
        """
        dist = series.value_counts(normalize=True).sort_index()
        
        fig, ax = plt.subplots(figsize=(6, 4))
        dist.plot(kind='bar', ax=ax, color="#4C78A8")
        ax.set_title(title)
        ax.set_ylabel("Proportion")
        ax.set_xlabel("Class")
        ax.set_ylim(0, 1)
        
        # Add value labels on bars
        for i, v in enumerate(dist.values):
            ax.text(i, v + 0.02, f"{v:.2f}", ha='center', va='bottom', fontsize=8)
        
        fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150)
        plt.close(fig)
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode('ascii')
        return b64

    @staticmethod
    def visualize_categorical_bias(
        df_before: pd.DataFrame,
        df_after: pd.DataFrame,
        target_col: str
    ) -> Dict[str, str]:
        """
        Create before/after charts for categorical bias.
        
        Args:
            df_before: Original DataFrame
            df_after: Corrected DataFrame
            target_col: Target column name
            
        Returns:
            Dictionary with 'before_chart' and 'after_chart' keys
        """
        s_before = df_before[target_col].dropna()
        s_after = df_after[target_col].dropna()
        
        if s_before.empty or s_after.empty:
            raise ValueError("No data in target column")
        
        before_b64 = VisualizationService.plot_categorical_distribution(
            s_before, f"Before: {target_col}"
        )
        after_b64 = VisualizationService.plot_categorical_distribution(
            s_after, f"After: {target_col}"
        )
        
        return {
            "before_chart": before_b64,
            "after_chart": after_b64
        }

    @staticmethod
    def plot_continuous_distribution(series: pd.Series, title: str, skew_val: float | None = None) -> str:
        """
        Create a histogram with KDE overlay for continuous distribution.
        
        Args:
            series: Pandas Series with continuous data
            title: Chart title
            skew_val: Optional skewness value to display
            
        Returns:
            Base64-encoded PNG image
        """
        fig, ax = plt.subplots(figsize=(7, 5))
        
        # Seaborn histplot with KDE overlay
        sns.histplot(
            x=series,
            bins=30,
            kde=True,
            color='#4C78A8',
            edgecolor='black',
            alpha=0.7,
            stat='density',
            ax=ax,
            line_kws={'linewidth': 2, 'color': 'red'}
        )
        
        title_with_skew = f"{title}\nSkewness: {skew_val:.3f}" if skew_val is not None else title
        ax.set_title(title_with_skew, fontsize=12, fontweight='bold')
        ax.set_xlabel("Value", fontsize=10)
        ax.set_ylabel("Density", fontsize=10)
        ax.grid(alpha=0.3)
        
        fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=120)
        plt.close(fig)
        buf.seek(0)
        b64 = base64.b64encode(buf.read()).decode('ascii')
        return b64

    @staticmethod
    def visualize_skewness(
        df_before: pd.DataFrame,
        df_after: pd.DataFrame,
        columns: List[str]
    ) -> Dict[str, Dict]:
        """
        Create before/after charts for skewness correction.
        
        Args:
            df_before: Original DataFrame
            df_after: Corrected DataFrame
            columns: List of column names to visualize
            
        Returns:
            Dictionary mapping column names to chart data
        """
        charts = {}
        
        for col in columns:
            if col not in df_before.columns:
                charts[col] = {"error": f"Column '{col}' not found in before dataset"}
                continue
            
            if col not in df_after.columns:
                charts[col] = {"error": f"Column '{col}' not found in after dataset"}
                continue
            
            try:
                # Get data and convert to numeric
                series_before = pd.to_numeric(df_before[col], errors='coerce').dropna()
                series_after = pd.to_numeric(df_after[col], errors='coerce').dropna()
                
                if series_before.empty or series_after.empty or len(series_before) < 2 or len(series_after) < 2:
                    charts[col] = {"error": "Insufficient data"}
                    continue
                
                # Compute skewness
                before_skew = compute_skewness(series_before)
                after_skew = compute_skewness(series_after)
                
                # Create charts
                before_chart = VisualizationService.plot_continuous_distribution(
                    series_before, f"Before: {col}", before_skew
                )
                after_chart = VisualizationService.plot_continuous_distribution(
                    series_after, f"After: {col}", after_skew
                )
                
                charts[col] = {
                    "before_chart": before_chart,
                    "after_chart": after_chart,
                    "before_skewness": float(before_skew) if before_skew is not None else None,
                    "after_skewness": float(after_skew) if after_skew is not None else None
                }
            
            except Exception as e:
                charts[col] = {"error": str(e)}
        
        return charts
