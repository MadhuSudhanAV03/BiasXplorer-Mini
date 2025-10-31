import logging
import pandas as pd
from scipy.stats import skew

logger = logging.getLogger(__name__)


def compute_skewness(series):
    """
    Compute skewness for a pandas Series.

    Converts values to numeric, drops NaNs, and calculates skewness using scipy.

    Args:
        series (pd.Series): Input pandas Series

    Returns:
        float or None: Skewness value, or None if series is empty after cleaning

    Raises:
        ValueError: If series has fewer than 2 non-NA numeric values
    """
    if not isinstance(series, pd.Series):
        raise TypeError("Input must be a pandas Series")

    # Convert to numeric, coercing errors to NaN
    numeric_series = pd.to_numeric(series, errors='coerce')

    # Drop NaN values
    clean_series = numeric_series.dropna()

    # Check if series is empty
    if len(clean_series) == 0:
        logger.warning("Series is empty after dropping NaNs")
        return None

    # Check minimum sample size
    if len(clean_series) < 2:
        logger.error(
            f"Insufficient data: only {len(clean_series)} non-NA numeric value(s)")
        raise ValueError(
            "Series must have at least 2 non-NA numeric values to compute skewness")

    # Compute skewness
    skewness_value = skew(clean_series)
    logger.info(
        f"Computed skewness: {skewness_value:.4f} (n={len(clean_series)})")

    return float(skewness_value)


if __name__ == "__main__":
    # Configure logging for test
    logging.basicConfig(level=logging.INFO)

    # Create test DataFrame
    df = pd.DataFrame({
        'normal': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        'right_skewed': [1, 1, 1, 2, 2, 3, 4, 8, 15, 50],
        'left_skewed': [50, 15, 8, 4, 3, 2, 2, 1, 1, 1],
        'with_nan': [1, 2, None, 4, 5, 6, 7, 8, 9, 10],
        'mixed_types': ['1', '2', 'invalid', '4', '5', '6', '7', '8', '9', '10']
    })

    print("Testing compute_skewness function:\n")

    for col in df.columns:
        try:
            skewness = compute_skewness(df[col])
            print(
                f"{col}: {skewness:.4f}" if skewness is not None else f"{col}: None")
        except ValueError as e:
            print(f"{col}: Error - {e}")
        except Exception as e:
            print(f"{col}: Unexpected error - {e}")

    print("\nTest with insufficient data:")
    try:
        compute_skewness(pd.Series([1]))
    except ValueError as e:
        print(f"Single value series: {e}")
