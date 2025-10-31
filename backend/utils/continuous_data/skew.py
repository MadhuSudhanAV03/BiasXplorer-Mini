import numpy as np
from scipy.stats import skew
from sklearn.preprocessing import QuantileTransformer, PowerTransformer


def skewness(df, continuous_columns):
    skewed_info = {}
    for col in continuous_columns:
        if col in df.columns:
            col_skewness = skew(df[col].dropna())
            skewed_info[col] = col_skewness
            print(f"Skewness of column '{col}': {col_skewness}")
        else:
            print(f"Column '{col}' not found in DataFrame.")
    return skewed_info


def handle_skew(df, col, skew_val):
    """
    Handle skewness correction based on the skewness value.

    Args:
        df: pandas DataFrame
        col: column name to apply transformation
        skew_val: skewness value

    Returns:
        DataFrame with transformed column
    """
    if skew_val > 0.5 and skew_val <= 2:
        # Handling the skew within the range +0.5 to +2
        df = handle_small_positive_skew(df, col, skew_val)
    elif skew_val < -0.5 and skew_val >= -2:
        # Handling the skew within the range -2 to -0.5
        df = handle_small_negative_skew(df, col, skew_val)
    elif (skew_val > 2 and skew_val <= 3) or (skew_val < -2 and skew_val >= -3):
        # Handling severe skew with the range -3 to -2 or +2 to +3
        df = handle_severe_skew(df, col)
    else:
        # Handling extreme skew i.e skew < -3 or skew > +3
        df = handle_extreme_skew(df, col)
    return df


def handle_extreme_skew(df, col):
    """Apply Quantile Transformer for extreme skew (|skew| > 3)"""
    df = apply_quantile_transformer(df, col)
    return df


def handle_severe_skew(df, col):
    """Apply Yeo-Johnson transformation for severe skew (2 < |skew| <= 3)"""
    df = apply_yeo_johnson(df, col)
    return df


def handle_small_negative_skew(df, col, skew_val):
    """Handle small negative skew (-2 <= skew < -0.5)"""
    if skew_val < -0.5 and skew_val >= -1:
        print("Applying Squared power method")
        df[col] = np.power(df[col], 2)
    else:
        print("Applying Cubed Power method")
        df[col] = np.power(df[col], 3)
    return df


def handle_small_positive_skew(df, col, skew_val):
    """Handle small positive skew (0.5 < skew <= 2)"""
    if skew_val > 0.5 and skew_val <= 1:
        print("Applying square root method")
        df[col] = np.sqrt(df[col])
    else:
        print("Applying log transformation method")
        df[col] = np.log1p(df[col])
    return df


def apply_quantile_transformer(df, col, output_distribution='normal', random_state=42):
    """Apply Quantile Transformer for extreme skew"""
    print("Applying Quantile Transformer method")
    qt = QuantileTransformer(
        output_distribution=output_distribution, random_state=random_state)
    df[col] = qt.fit_transform(df[[col]])
    return df


def apply_yeo_johnson(df, col):
    """Apply Yeo-Johnson transformation for severe skew"""
    print("Applying yeo johnson method")
    pt = PowerTransformer(method='yeo-johnson')
    df[col] = pt.fit_transform(df[[col]])
    return df
