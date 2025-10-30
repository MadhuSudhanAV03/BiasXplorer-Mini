import numpy as np

def auto_thresholds(df,
                    min_unique_base=2,
                    max_cat_unique_factor=0.1,
                    default_cat_fraction=0.05,
                    default_id_fraction=0.9):
    """
    Automatically choose thresholds for column classification,
    adapting to each dataset without a fixed '20'.

    Parameters
    ----------
    df : pandas.DataFrame
        Your dataset.
    min_unique_base : int, optional
        The minimum absolute unique count for the categorical cutoff (default 2).
    max_cat_unique_factor : float, optional
        Max fraction of rows to use for cat_unique_thresh (adapts to dataset size).
    default_cat_fraction : float, optional
        Fraction of total rows below which numeric becomes categorical.
    default_id_fraction : float, optional
        Fraction of unique values above which a column is considered identifier-like.

    Returns
    -------
    dict
        {
            'cat_unique_thresh': ...,
            'cat_fraction_thresh': ...,
            'id_fraction_thresh': ...
        }
    """

    rows = len(df)
    if rows == 0:
        return {
            'cat_unique_thresh': min_unique_base,
            'cat_fraction_thresh': default_cat_fraction,
            'id_fraction_thresh': default_id_fraction
        }

    # get median uniqueness across columns
    uniques = [df[col].nunique(dropna=True) for col in df.columns]
    median_unique = np.median(uniques) if uniques else min_unique_base

    # adapt cutoff: 2x median uniqueness, but at least min_unique_base,
    # and no more than (rows * max_cat_unique_factor)
    cat_unique_thresh = int(
        min(
            max(min_unique_base, median_unique * 2),
            max(min_unique_base, rows * max_cat_unique_factor)
        )
    )

    cat_fraction_thresh = default_cat_fraction
    id_fraction_thresh = default_id_fraction

    return {
        'cat_unique_thresh': cat_unique_thresh,
        'cat_fraction_thresh': cat_fraction_thresh,
        'id_fraction_thresh': id_fraction_thresh
    }
