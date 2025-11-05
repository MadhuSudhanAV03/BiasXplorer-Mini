"""Visualization service for generating charts."""
from utils.data_stats import compute_skewness
from typing import Dict, List
import pandas as pd
import plotly.graph_objects as go
import json


class VisualizationService:
    """Service for generating visualization charts."""

    @staticmethod
    def plot_categorical_distribution(series: pd.Series, title: str) -> str:
        """
        Create an interactive bar plot of categorical distribution using Plotly.

        Args:
            series: Pandas Series with categorical data
            title: Chart title

        Returns:
            JSON string with Plotly figure data
        """
        dist = series.value_counts(normalize=True).sort_index()

        # Convert to Python native types to avoid JSON serialization issues
        x_values = [str(x) for x in dist.index.tolist()]
        y_values = [float(y) for y in dist.values.tolist()]
        text_values = [f"{v:.2%}" for v in y_values]

        # Create interactive bar chart with Plotly
        fig = go.Figure(data=[
            go.Bar(
                x=x_values,
                y=y_values,
                text=text_values,
                textposition='outside',
                marker=dict(
                    color='#4C78A8',
                    line=dict(color='#2C5282', width=1)
                ),
                hovertemplate='<b>%{x}</b><br>' +
                              'Proportion: %{y:.2%}<br>' +
                              '<extra></extra>'
            )
        ])

        fig.update_layout(
            title=dict(text=title, font=dict(size=16, weight='bold')),
            xaxis_title="Class",
            yaxis_title="Proportion",
            yaxis=dict(range=[0, 1], tickformat='.0%'),
            plot_bgcolor='white',
            height=400,
            margin=dict(l=50, r=50, t=60, b=50),
            hovermode='closest'
        )

        fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='#E2E8F0')
        fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='#E2E8F0')

        # Return as JSON
        return json.dumps(fig.to_dict())

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
            Dictionary with 'before_chart' and 'after_chart' keys (Plotly JSON)
        """
        s_before = df_before[target_col].dropna()
        s_after = df_after[target_col].dropna()

        if s_before.empty or s_after.empty:
            raise ValueError("No data in target column")

        before_json = VisualizationService.plot_categorical_distribution(
            s_before, f"Before: {target_col}"
        )
        after_json = VisualizationService.plot_categorical_distribution(
            s_after, f"After: {target_col}"
        )

        return {
            "before_chart": before_json,
            "after_chart": after_json
        }

    @staticmethod
    def plot_continuous_distribution(series: pd.Series, title: str, skew_val: float | None = None) -> str:
        """
        Create an interactive histogram with KDE overlay for continuous distribution using Plotly.

        Args:
            series: Pandas Series with continuous data
            title: Chart title
            skew_val: Optional skewness value to display

        Returns:
            JSON string with Plotly figure data
        """
        from scipy import stats
        import numpy as np

        # Create histogram
        fig = go.Figure()

        # Add histogram
        fig.add_trace(go.Histogram(
            x=series,
            nbinsx=30,
            name='Histogram',
            marker=dict(
                color='#4C78A8',
                line=dict(color='#2C5282', width=1)
            ),
            opacity=0.7,
            histnorm='probability density',
            hovertemplate='Value: %{x}<br>Density: %{y:.4f}<extra></extra>'
        ))

        # Add KDE line using scipy
        kde = stats.gaussian_kde(series)
        x_range = np.linspace(series.min(), series.max(), 200)
        kde_values = kde(x_range)

        fig.add_trace(go.Scatter(
            x=x_range,
            y=kde_values,
            mode='lines',
            name='KDE',
            line=dict(color='red', width=2),
            hovertemplate='Value: %{x:.2f}<br>Density: %{y:.4f}<extra></extra>'
        ))

        # Update layout
        title_with_skew = f"{title}<br>Skewness: {skew_val:.3f}" if skew_val is not None else title
        fig.update_layout(
            title=dict(text=title_with_skew,
                       font=dict(size=14, weight='bold')),
            xaxis_title="Value",
            yaxis_title="Density",
            plot_bgcolor='white',
            height=450,
            margin=dict(l=50, r=50, t=80, b=50),
            hovermode='closest',
            showlegend=True,
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=1.02,
                xanchor="right",
                x=1
            )
        )

        fig.update_xaxes(showgrid=True, gridwidth=1, gridcolor='#E2E8F0')
        fig.update_yaxes(showgrid=True, gridwidth=1, gridcolor='#E2E8F0')

        # Return as JSON
        return json.dumps(fig.to_dict())

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
                charts[col] = {
                    "error": f"Column '{col}' not found in before dataset"}
                continue

            if col not in df_after.columns:
                charts[col] = {
                    "error": f"Column '{col}' not found in after dataset"}
                continue

            try:
                # Get data and convert to numeric
                series_before = pd.to_numeric(
                    df_before[col], errors='coerce').dropna()
                series_after = pd.to_numeric(
                    df_after[col], errors='coerce').dropna()

                if series_before.empty or series_after.empty or len(series_before) < 2 or len(series_after) < 2:
                    charts[col] = {"error": "Insufficient data"}
                    continue

                # Compute skewness
                before_skew = compute_skewness(series_before)
                after_skew = compute_skewness(series_after)

                # Create charts
                before_json = VisualizationService.plot_continuous_distribution(
                    series_before, f"Before: {col}", before_skew
                )
                after_json = VisualizationService.plot_continuous_distribution(
                    series_after, f"After: {col}", after_skew
                )

                charts[col] = {
                    "before_chart": before_json,
                    "after_chart": after_json,
                    "before_skewness": float(before_skew) if before_skew is not None else None,
                    "after_skewness": float(after_skew) if after_skew is not None else None
                }

            except Exception as e:
                charts[col] = {"error": str(e)}

        return charts
