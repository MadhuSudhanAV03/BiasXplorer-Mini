from scipy.stats import skew

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
